import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHmac } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhooksService } from './webhooks.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Transaction, TransactionStatus } from '../payments/entities/transaction.entity';
import { TransactionStateHistory } from '../payments/entities/transaction-state-history.entity';
import { LedgerService } from '../ledger/ledger.service';
import { PaymentsService } from '../payments/payments.service';

const WEBHOOK_SECRET = 'test_webhook_secret';

function makeSignature(body: Buffer): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

describe('WebhooksService', () => {
  let service: WebhooksService;
  let dataSource: jest.Mocked<DataSource>;
  let ledgerService: jest.Mocked<LedgerService>;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockTransaction: Partial<Transaction> = {
    id: 'txn-id-1',
    providerReference: 'prov_test123',
    senderAccountId: 'sender-account-id',
    recipientAccountId: 'recipient-account-id',
    sourceCurrency: 'NGN',
    destinationCurrency: 'USD',
    sourceAmount: '500000.00000000',
    destinationAmount: '322.50000000',
    status: TransactionStatus.PROCESSING,
  };

  const buildManager = (overrides: Partial<any> = {}) => ({
    update: jest.fn(),
    save: jest.fn(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: { update: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockTransaction),
          },
        },
        {
          provide: getRepositoryToken(TransactionStateHistory),
          useValue: { save: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
            transaction: jest.fn(),
          },
        },
        {
          provide: LedgerService,
          useValue: {
            credit: jest.fn().mockResolvedValue({}),
            createCompensatingEntries: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            validateTransition: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(WEBHOOK_SECRET) },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    dataSource = module.get(DataSource);
    ledgerService = module.get(LedgerService);
    paymentsService = module.get(PaymentsService);
  });

  describe('processWebhook — idempotency', () => {
    it('should skip processing for a duplicate webhook (ON CONFLICT returns empty)', async () => {
      const payload = {
        reference: 'prov_test123',
        status: 'completed',
        amount: 322.5,
        currency: 'USD',
      };
      const body = Buffer.from(JSON.stringify(payload));
      const sig = makeSignature(body);

      
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.processWebhook(payload as any, body, sig);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(ledgerService.credit).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook — signature verification', () => {
    it('should not process webhooks with invalid signatures', async () => {
      const payload = {
        reference: 'prov_test123',
        status: 'completed',
        amount: 322.5,
        currency: 'USD',
      };
      const body = Buffer.from(JSON.stringify(payload));

      const fakeEvent = { id: 'event-id-1', ...payload, processed: false };
      (dataSource.query as jest.Mock).mockResolvedValueOnce([fakeEvent]);

      await service.processWebhook(payload as any, body, 'invalid_signature');

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should process webhooks with valid signatures', async () => {
      const payload = {
        reference: 'prov_test123',
        status: 'completed',
        amount: 322.5,
        currency: 'USD',
      };
      const body = Buffer.from(JSON.stringify(payload));
      const sig = makeSignature(body);

      const fakeEvent = { id: 'event-id-2', ...payload, processed: false };
      (dataSource.query as jest.Mock).mockResolvedValueOnce([fakeEvent]);

      const manager = buildManager();
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => cb(manager));

      await service.processWebhook(payload as any, body, sig);

      expect(ledgerService.credit).toHaveBeenCalledWith(
        mockTransaction.recipientAccountId,
        mockTransaction.destinationAmount,
        mockTransaction.id,
        manager,
      );
    });
  });

  describe('processWebhook — state transitions', () => {
    it('should credit recipient on completed', async () => {
      const payload = {
        reference: 'prov_test123',
        status: 'completed',
        amount: 322.5,
        currency: 'USD',
      };
      const body = Buffer.from(JSON.stringify(payload));
      const sig = makeSignature(body);

      const fakeEvent = { id: 'event-id-3', ...payload, processed: false };
      (dataSource.query as jest.Mock).mockResolvedValueOnce([fakeEvent]);

      const manager = buildManager();
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => cb(manager));

      await service.processWebhook(payload as any, body, sig);

      expect(ledgerService.credit).toHaveBeenCalledTimes(1);
      expect(manager.update).toHaveBeenCalledWith(
        Transaction,
        mockTransaction.id,
        expect.objectContaining({ status: TransactionStatus.COMPLETED }),
      );
    });

    it('should create compensating entries on failed', async () => {
      const payload = {
        reference: 'prov_test123',
        status: 'failed',
        amount: 322.5,
        currency: 'USD',
      };
      const body = Buffer.from(JSON.stringify(payload));
      const sig = makeSignature(body);

      const fakeEvent = { id: 'event-id-4', ...payload, processed: false };
      (dataSource.query as jest.Mock).mockResolvedValueOnce([fakeEvent]);

      const manager = buildManager();
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => cb(manager));

      await service.processWebhook(payload as any, body, sig);

      expect(ledgerService.createCompensatingEntries).toHaveBeenCalledWith(
        mockTransaction.id,
        manager,
      );
      expect(manager.update).toHaveBeenCalledWith(
        Transaction,
        mockTransaction.id,
        expect.objectContaining({ status: TransactionStatus.FAILED }),
      );
    });

    it('should not process when validateTransition throws', async () => {
      const payload = {
        reference: 'prov_test123',
        status: 'completed',
        amount: 322.5,
        currency: 'USD',
      };
      const body = Buffer.from(JSON.stringify(payload));
      const sig = makeSignature(body);

      const fakeEvent = { id: 'event-id-5', ...payload, processed: false };
      (dataSource.query as jest.Mock).mockResolvedValueOnce([fakeEvent]);

      (paymentsService.validateTransition as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid transition');
      });

      await service.processWebhook(payload as any, body, sig);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(ledgerService.credit).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook — unknown reference', () => {
    it('should return gracefully for unknown provider reference', async () => {
      const payload = {
        reference: 'prov_unknown_ref',
        status: 'completed',
        amount: 100,
        currency: 'USD',
      };
      const body = Buffer.from(JSON.stringify(payload));
      const sig = makeSignature(body);

      const fakeEvent = { id: 'event-id-6', ...payload, processed: false };
      (dataSource.query as jest.Mock).mockResolvedValueOnce([fakeEvent]);

      const txnRepo = service['transactionRepo'];
      (txnRepo.findOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.processWebhook(payload as any, body, sig)).resolves.toBeUndefined();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
