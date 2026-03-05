import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, DataSource, IsNull, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transaction, TransactionStatus, VALID_TRANSITIONS } from './entities/transaction.entity';
import { TransactionStateHistory } from './entities/transaction-state-history.entity';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { Account } from '../accounts/entities/account.entity';
import { AccountsService } from '../accounts/accounts.service';
import { LedgerService } from '../ledger/ledger.service';
import { FxService } from '../fx/fx.service';
import { RedisService } from '../redis/redis.service';
import { PaymentRefundedEvent } from '../events/payment.events';
import { PROVIDER_QUEUE, PROVIDER_JOB_OPTIONS } from '../queue/queue.constants';
import type { ProviderJobData } from '../queue/provider.processor';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

const ACCOUNT_LOCK_TTL_MS = 15_000;
const REFUND_LOCK_TTL_MS = 30_000;
const STATS_CACHE_KEY = 'payments:stats';
const STATS_CACHE_TTL_MS = 30_000;
const LIST_CACHE_TTL_MS = 10_000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(TransactionStateHistory)
    private readonly stateHistoryRepo: Repository<TransactionStateHistory>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerEntryRepo: Repository<LedgerEntry>,
    @InjectQueue(PROVIDER_QUEUE)
    private readonly providerQueue: Queue<ProviderJobData>,
    private readonly dataSource: DataSource,
    private readonly accountsService: AccountsService,
    private readonly ledgerService: LedgerService,
    private readonly fxService: FxService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  
  async createPayment(dto: CreatePaymentDto, idempotencyKey: string): Promise<Transaction> {
    const lockKey = `account:${dto.senderAccountId}`;

    const lockToken = await this.redisService.acquireLock(lockKey, ACCOUNT_LOCK_TTL_MS);
    if (lockToken === null) {
      throw new ConflictException(
        'This account has a concurrent payment in progress. Please retry in a moment.',
      );

    }

    let savedTransaction: Transaction;

    try {
      await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        
        
        
        let senderAccount: Account;
        try {
          senderAccount = await this.accountsService.lockForUpdate(dto.senderAccountId, manager);
        } catch (err) {
          if (err.message?.includes('could not obtain lock')) {
            throw new ConflictException('Account locked by concurrent transaction.');
          }
          throw err;
        }

        if (senderAccount.currency !== dto.sourceCurrency) {
          throw new BadRequestException(
            `Sender account currency (${senderAccount.currency}) does not match source currency (${dto.sourceCurrency})`,
          );
        }

        const recipientAccount = await manager
          .getRepository('accounts')
          .findOne({ where: { id: dto.recipientAccountId } }) as Account;

        if (!recipientAccount) {
          throw new NotFoundException(`Recipient account ${dto.recipientAccountId} not found`);
        }

        if (recipientAccount.currency !== dto.destinationCurrency) {
          throw new BadRequestException(
            `Recipient account currency (${recipientAccount.currency}) does not match destination currency (${dto.destinationCurrency})`,
          );
        }

        
        
        const fxQuote = await this.fxService.createQuote(
          dto.sourceCurrency,
          dto.destinationCurrency,
          dto.amount.toString(),
          manager,
        );

        
        
        
        if (fxQuote.isExpired) {
          throw new BadRequestException(
            `FX quote expired before funds could be reserved — please retry to get a fresh rate`,
          );
        }

        
        const transaction = manager.create(Transaction, {
          senderAccountId: dto.senderAccountId,
          recipientAccountId: dto.recipientAccountId,
          sourceCurrency: dto.sourceCurrency,
          destinationCurrency: dto.destinationCurrency,
          sourceAmount: dto.amount.toString(),
          destinationAmount: fxQuote.destinationAmount,
          fxRate: fxQuote.rate,
          fxQuoteId: fxQuote.id,
          status: TransactionStatus.INITIATED,
        });
        savedTransaction = await manager.save(Transaction, transaction);

        await manager.save(TransactionStateHistory, {
          transactionId: savedTransaction.id,
          fromState: null,
          toState: TransactionStatus.INITIATED,
          metadata: { idempotencyKey, initiatedBy: 'api' },
        });

        
        
        
        await this.ledgerService.debit(
          dto.senderAccountId,
          dto.amount.toString(),
          savedTransaction.id,
          manager,
        );

        
        await manager.update(Transaction, savedTransaction.id, {
          status: TransactionStatus.PROCESSING,
        });
        savedTransaction.status = TransactionStatus.PROCESSING;

        await manager.save(TransactionStateHistory, {
          transactionId: savedTransaction.id,
          fromState: TransactionStatus.INITIATED,
          toState: TransactionStatus.PROCESSING,
          metadata: { fundsFrozen: true },
        });
      });
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken).catch((err) => {
        this.logger.warn(`releaseLock failed for account=${dto.senderAccountId}: ${err.message}`);
      });
    }

    await this.providerQueue.add(
      'submit-to-provider',
      {
        transactionId: savedTransaction.id,
        sourceAmount: savedTransaction.sourceAmount,
        sourceCurrency: dto.sourceCurrency,
        destinationCurrency: dto.destinationCurrency,
        senderAccountId: dto.senderAccountId,
        idempotencyKey,
      },
      PROVIDER_JOB_OPTIONS,
    );

    await this.invalidatePaymentCaches();

    return savedTransaction;
  }

  
  async refundPayment(id: string, dto: RefundPaymentDto): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({
      where: { id },
      relations: ['senderAccount', 'recipientAccount'],
    });

    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);

    
    
    this.validateTransition(transaction.status, TransactionStatus.REVERSED);

    const lockKey = `refund:${id}`;

    const refundToken = await this.redisService.acquireLock(lockKey, REFUND_LOCK_TTL_MS);
    if (refundToken === null) {
      throw new ConflictException('A refund is already being processed for this transaction.');
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        
        
        
        let current: Transaction;
        try {
          current = await manager
            .createQueryBuilder(Transaction, 't')
            .where('t.id = :id', { id })
            .setLock('pessimistic_write_or_fail')
            .getOne();
        } catch (err) {
          if (err.message?.includes('could not obtain lock')) {
            throw new ConflictException('Transaction is being modified by a concurrent request.');
          }
          throw err;
        }

        if (!current) throw new NotFoundException(`Transaction ${id} not found`);

        
        this.validateTransition(current.status, TransactionStatus.REVERSED);

        if (current.status === TransactionStatus.COMPLETED) {
          
          
          const alreadyReversed = await this.ledgerService.hasBeenReversed(id, manager);
          if (!alreadyReversed) {
            await this.ledgerService.debit(
              current.recipientAccountId,
              current.destinationAmount,
              current.id,
              manager,
            );
            await this.ledgerService.credit(
              current.senderAccountId,
              current.sourceAmount,
              current.id,
              manager,
            );
          } else {
            this.logger.warn(
              `Chargeback requested for txn=${id} but reversal entries already exist — skipping ledger write`,
            );
          }
        } else {
          
          const alreadyReversed = await this.ledgerService.hasBeenReversed(id, manager);
          if (!alreadyReversed) {
            await this.ledgerService.createCompensatingEntries(id, manager);
          } else {
            this.logger.warn(
              `Refund requested for txn=${id} but compensating entries already exist — skipping ledger write`,
            );
          }
        }

        await manager.update(Transaction, id, { status: TransactionStatus.REVERSED });

        await manager.save(TransactionStateHistory, {
          transactionId: id,
          fromState: current.status,
          toState: TransactionStatus.REVERSED,
          metadata: {
            reason: dto.reason,
            refundedAt: new Date().toISOString(),
            type: current.status === TransactionStatus.COMPLETED ? 'chargeback' : 'reversal',
          },
        });
      });
    } finally {
      await this.redisService.releaseLock(lockKey, refundToken).catch((err) => {
        this.logger.warn(`releaseLock failed for refund txn=${id}: ${err.message}`);
      });
    }

    this.eventEmitter.emit(
      'payment.refunded',
      new PaymentRefundedEvent(id, dto.reason, new Date()),
    );

    await this.invalidatePaymentCaches();

    return this.transactionRepo.findOne({ where: { id } });
  }

  async findById(id: string): Promise<{
    transaction: Transaction;
    ledgerEntries: LedgerEntry[];
    stateHistory: TransactionStateHistory[];
  }> {
    const transaction = await this.transactionRepo.findOne({
      where: { id },
      relations: ['senderAccount', 'recipientAccount'],
    });

    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);

    const ledgerEntries = await this.ledgerEntryRepo.find({
      where: { transactionId: id },
      order: { createdAt: 'ASC' },
    });

    const stateHistory = await this.stateHistoryRepo.find({
      where: { transactionId: id },
      order: { timestamp: 'ASC' },
    });

    return { transaction, ledgerEntries, stateHistory };
  }

  async findAll(dto: ListPaymentsDto): Promise<{
    data: Transaction[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const cacheKey = `payments:list:${page}:${limit}:${dto.status || 'all'}`;
    if (!dto.startDate && !dto.endDate) {
      const cached = await this.redisService.getObject<{
        data: Transaction[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(cacheKey);
      if (cached) return cached;
    }

    const skip = (page - 1) * limit;

    const query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.senderAccount', 'sender')
      .leftJoinAndSelect('t.recipientAccount', 'recipient')
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (dto.status) {
      query.andWhere('t.status = :status', { status: dto.status });
    }
    if (dto.startDate) {
      query.andWhere('t.createdAt >= :startDate', { startDate: new Date(dto.startDate) });
    }
    if (dto.endDate) {
      const end = new Date(dto.endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere('t.createdAt <= :endDate', { endDate: end });
    }

    const [data, total] = await query.getManyAndCount();
    const result = { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };

    if (!dto.startDate && !dto.endDate) {
      this.redisService.setObject(cacheKey, result, LIST_CACHE_TTL_MS).catch(() => {});
    }

    return result;
  }

  async getStats(): Promise<{
    counts: Record<string, number>;
    totalVolumeByStatus: Record<string, string>;
    stuckCount: number;
    stuckThresholdMinutes: number;
  }> {
    type StatsResult = {
      counts: Record<string, number>;
      totalVolumeByStatus: Record<string, string>;
      stuckCount: number;
      stuckThresholdMinutes: number;
    };

    const cached = await this.redisService.getObject<StatsResult>(STATS_CACHE_KEY);
    if (cached) return cached;

    const STUCK_THRESHOLD_MS = 30 * 60 * 1_000;
    const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

    const [statusRows, stuckCount] = await Promise.all([
      this.transactionRepo
        .createQueryBuilder('t')
        .select('t.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(t.source_amount::NUMERIC), 0)', 'totalVolume')
        .groupBy('t.status')
        .getRawMany<{ status: string; count: string; totalVolume: string }>(),

      this.transactionRepo.count({
        where: {
          status: TransactionStatus.PROCESSING,
          providerReference: IsNull(),
          createdAt: LessThan(stuckCutoff),
        },
      }),
    ]);

    const counts: Record<string, number> = {};
    const totalVolumeByStatus: Record<string, string> = {};

    for (const row of statusRows) {
      counts[row.status] = parseInt(row.count, 10);
      totalVolumeByStatus[row.status] = parseFloat(row.totalVolume).toFixed(2);
    }

    const result: StatsResult = { counts, totalVolumeByStatus, stuckCount, stuckThresholdMinutes: 30 };
    this.redisService.setObject(STATS_CACHE_KEY, result, STATS_CACHE_TTL_MS).catch(() => {});

    return result;
  }

  
  async findStuck(thresholdMinutes = 30): Promise<Transaction[]> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1_000);
    return this.transactionRepo.find({
      where: {
        status: TransactionStatus.PROCESSING,
        providerReference: IsNull(),
        createdAt: LessThan(cutoff),
      },
      relations: ['senderAccount', 'recipientAccount'],
      order: { createdAt: 'ASC' },
    });
  }

  async invalidatePaymentCaches(): Promise<void> {
    await Promise.all([
      this.redisService.del(STATS_CACHE_KEY),
      this.redisService.deleteByPattern('payments:list:*'),
    ]).catch((err) => {
      this.logger.warn(`Cache invalidation failed: ${err.message}`);
    });
  }

  validateTransition(current: TransactionStatus, next: TransactionStatus): void {
    const allowed = VALID_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      throw new ConflictException(
        `Invalid state transition: ${current} → ${next}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }
  }
}
