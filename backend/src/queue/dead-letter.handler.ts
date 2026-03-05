import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, QueueEvents } from 'bullmq';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transaction, TransactionStatus } from '../payments/entities/transaction.entity';
import { TransactionStateHistory } from '../payments/entities/transaction-state-history.entity';
import { LedgerService } from '../ledger/ledger.service';
import { PaymentFailedEvent } from '../events/payment.events';
import { PROVIDER_QUEUE, WEBHOOK_QUEUE } from './queue.constants';
import type { ProviderJobData } from './provider.processor';

@Injectable()
export class DeadLetterHandler implements OnModuleInit {
  private readonly logger = new Logger(DeadLetterHandler.name);
  private providerQueueEvents: QueueEvents;
  private webhookQueueEvents: QueueEvents;

  constructor(
    @InjectQueue(PROVIDER_QUEUE)
    private readonly providerQueue: Queue<ProviderJobData>,
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: LedgerService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
    };

    this.providerQueueEvents = new QueueEvents(PROVIDER_QUEUE, { connection });
    this.webhookQueueEvents = new QueueEvents(WEBHOOK_QUEUE, { connection });

    this.providerQueueEvents.on('failed', async ({ jobId, failedReason }) => {
      await this.onProviderJobExhausted(jobId, failedReason);
    });

    this.webhookQueueEvents.on('failed', async ({ jobId, failedReason }) => {
      this.logger.error(
        `[DEAD LETTER] Webhook job ${jobId} permanently failed: ${failedReason}`,
      );
    });

    this.logger.log('Dead-letter listeners registered for provider and webhook queues');
  }

  private async onProviderJobExhausted(jobId: string, failedReason: string): Promise<void> {
    const job = await this.providerQueue.getJob(jobId);
    if (!job) return;

    if (job.attemptsMade < (job.opts.attempts ?? 3)) return;

    const { transactionId } = job.data;

    this.logger.error(
      `[DEAD LETTER] Provider job exhausted for txn=${transactionId} after ${job.attemptsMade} attempts: ${failedReason}`,
    );

    try {
      await this.dataSource.transaction(async (manager) => {
        const txn = await manager
          .createQueryBuilder(Transaction, 't')
          .where('t.id = :id', { id: transactionId })
          .setLock('pessimistic_write')
          .getOne();

        if (!txn || txn.status !== TransactionStatus.PROCESSING) return;

        const alreadyReversed = await this.ledgerService.hasBeenReversed(transactionId, manager);
        if (!alreadyReversed) {
          await this.ledgerService.createCompensatingEntries(transactionId, manager);
        }

        await manager.update(Transaction, transactionId, {
          status: TransactionStatus.FAILED,
        });

        await manager.save(TransactionStateHistory, {
          transactionId,
          fromState: TransactionStatus.PROCESSING,
          toState: TransactionStatus.FAILED,
          metadata: {
            reason: `Provider submission permanently failed after ${job.attemptsMade} attempts`,
            failedReason,
            autoReversed: !alreadyReversed,
          },
        });
      });

      this.eventEmitter.emit(
        'payment.failed',
        new PaymentFailedEvent(transactionId, '', `Dead letter: ${failedReason}`),
      );

      this.logger.log(`Auto-reversed txn=${transactionId} after provider exhaustion`);
    } catch (err) {
      this.logger.error(
        `Failed to auto-reverse txn=${transactionId}: ${err.message}`,
        err.stack,
      );
    }
  }
}
