import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentsService } from './payments.service';
import { Transaction, TransactionStatus, VALID_TRANSITIONS } from './entities/transaction.entity';
import { TransactionStateHistory } from './entities/transaction-state-history.entity';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { AccountsService } from '../accounts/accounts.service';
import { LedgerService } from '../ledger/ledger.service';
import { FxService } from '../fx/fx.service';
import { RedisService } from '../redis/redis.service';
import { PROVIDER_QUEUE } from '../queue/queue.constants';

const mockTransactionRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockStateHistoryRepo = () => ({ find: jest.fn(), save: jest.fn() });
const mockLedgerEntryRepo = () => ({ find: jest.fn() });

describe('PaymentsService', () => {
  let service: PaymentsService;
  let accountsService: jest.Mocked<AccountsService>;
  let ledgerService: jest.Mocked<LedgerService>;
  let fxService: jest.Mocked<FxService>;
  let dataSource: jest.Mocked<DataSource>;
  let redisService: jest.Mocked<RedisService>;
  let providerQueue: { add: jest.Mock };

  const mockAccount = {
    id: 'account-id-1',
    userId: 'user-alice',
    currency: 'NGN',
    balance: '10000000.00000000',
    version: 1,
  };

  const mockRecipientAccount = {
    id: 'account-id-2',
    userId: 'user-bob',
    currency: 'USD',
    balance: '0.00000000',
    version: 1,
  };

  const mockFxQuote = {
    id: 'quote-id-1',
    fromCurrency: 'NGN',
    toCurrency: 'USD',
    rate: '0.00064500',
    sourceAmount: '500000.00000000',
    destinationAmount: '322.50000000',
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date(),
    get isExpired() { return new Date() > this.expiresAt; },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Transaction), useFactory: mockTransactionRepo },
        { provide: getRepositoryToken(TransactionStateHistory), useFactory: mockStateHistoryRepo },
        { provide: getRepositoryToken(LedgerEntry), useFactory: mockLedgerEntryRepo },
        {
          provide: getQueueToken(PROVIDER_QUEUE),
          useValue: { add: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (_level, cb) => {
              const manager: any = {
                findOne: jest.fn().mockResolvedValue(mockAccount),
                save: jest.fn().mockImplementation((entity, data) => ({ ...data, id: 'txn-id-1' })),
                create: jest.fn((entity, data) => data),
                update: jest.fn(),
                getRepository: jest.fn(() => ({
                  findOne: jest.fn().mockResolvedValue(mockRecipientAccount),
                })),
              };
              return cb(manager);
            }),
          },
        },
        {
          provide: AccountsService,
          useValue: {
            lockForUpdate: jest.fn().mockResolvedValue(mockAccount),
            findById: jest.fn().mockResolvedValue(mockAccount),
          },
        },
        {
          provide: LedgerService,
          useValue: {
            debit: jest.fn().mockResolvedValue({}),
            credit: jest.fn().mockResolvedValue({}),
            createCompensatingEntries: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: FxService,
          useValue: {
            createQuote: jest.fn().mockResolvedValue(mockFxQuote),
          },
        },
        {
          provide: RedisService,
          useValue: {
            acquireLock: jest.fn().mockResolvedValue('mock-token'),
            releaseLock: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            getObject: jest.fn().mockResolvedValue(null),
            setObject: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    accountsService = module.get(AccountsService);
    ledgerService = module.get(LedgerService);
    fxService = module.get(FxService);
    dataSource = module.get(DataSource);
    redisService = module.get(RedisService);
    providerQueue = module.get(getQueueToken(PROVIDER_QUEUE));
  });

  describe('createPayment', () => {
    const validDto = {
      senderAccountId: 'account-id-1',
      recipientAccountId: 'account-id-2',
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      amount: 500000,
    };

    it('should create a payment, debit sender via ledger, and enqueue provider job', async () => {
      const result = await service.createPayment(validDto, 'idempotency-key-1');

      expect(ledgerService.debit).toHaveBeenCalledWith(
        validDto.senderAccountId,
        validDto.amount.toString(),
        expect.any(String),
        expect.any(Object),
      );
      expect(providerQueue.add).toHaveBeenCalledWith(
        'submit-to-provider',
        expect.objectContaining({ transactionId: expect.any(String) }),
        expect.any(Object),
      );
      expect(result).toBeDefined();
    });

    it('should throw ConflictException when Redis lock is held', async () => {
      (redisService.acquireLock as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.createPayment(validDto, 'key-conflict')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('validateTransition', () => {
    it('should allow valid transitions', () => {
      expect(() =>
        service.validateTransition(TransactionStatus.PROCESSING, TransactionStatus.COMPLETED),
      ).not.toThrow();

      expect(() =>
        service.validateTransition(TransactionStatus.PROCESSING, TransactionStatus.FAILED),
      ).not.toThrow();
    });

    it('should reject invalid transitions', () => {
      expect(() =>
        service.validateTransition(TransactionStatus.REVERSED, TransactionStatus.COMPLETED),
      ).toThrow(ConflictException);
    });

    it('should allow COMPLETED -> REVERSED for chargebacks', () => {
      expect(() =>
        service.validateTransition(TransactionStatus.COMPLETED, TransactionStatus.REVERSED),
      ).not.toThrow();
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException for unknown transaction', async () => {
      const txnRepo = service['transactionRepo'];
      (txnRepo.findOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
