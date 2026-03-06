import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { Transaction, TransactionStatus } from '../payments/entities/transaction.entity';
import { TransactionStateHistory } from '../payments/entities/transaction-state-history.entity';
import { LedgerService } from '../ledger/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { PaymentCompletedEvent, PaymentFailedEvent } from '../events/payment.events';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: LedgerService,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  async processWebhook(
    payload: WebhookPayloadDto,
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    const signatureValid = this.verifySignature(rawBody, signature);

    const result = await this.dataSource.query<WebhookEvent[]>(
      `INSERT INTO webhook_events
         (id, provider_reference, event_type, payload, signature, signature_valid, received_at, processed)
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4, $5, NOW(), false)
       ON CONFLICT (provider_reference, event_type) DO NOTHING
       RETURNING *`,
      [
        payload.reference,
        payload.status,
        JSON.stringify(payload),
        signature || null,
        signatureValid,
      ],
    );

    if (!result || result.length === 0) {
      this.logger.warn(`Duplicate webhook ignored: ref=${payload.reference} type=${payload.status}`);
      return;
    }

    const webhookEvent = result[0];

    if (!signatureValid) {
      this.logger.warn(
        `Invalid signature for ref=${payload.reference} — logged but not processed`,
      );
      await this.webhookEventRepo.update(webhookEvent.id, { error: 'Invalid HMAC signature' });
      return;
    }

    let processedTransaction: Transaction | null = null;

    try {
      await this.dataSource.transaction(async (manager) => {
        const transaction = await manager
          .createQueryBuilder(Transaction, 't')
          .where('t.providerReference = :ref', { ref: payload.reference })
          .setLock('pessimistic_write')
          .getOne();

        if (!transaction) {
          this.logger.warn(`Unknown provider reference: ${payload.reference}`);
          await manager.update(WebhookEvent, webhookEvent.id, {
            error: `No transaction found for provider reference ${payload.reference}`,
          });
          return;
        }

        this.paymentsService.validateTransition(
          transaction.status,
          payload.status as TransactionStatus,
        );

        if (payload.status === 'completed') {
          await this.ledgerService.credit(
            transaction.recipientAccountId,
            transaction.destinationAmount,
            transaction.id,
            manager,
          );

          await manager.update(Transaction, transaction.id, {
            status: TransactionStatus.COMPLETED,
            completedAt: new Date(),
          });

          this.logger.log(
            `Payment completed: txn=${transaction.id} credited=${transaction.destinationAmount} ${transaction.destinationCurrency}`,
          );
        } else if (payload.status === 'failed') {
          await this.ledgerService.createCompensatingEntries(transaction.id, manager);

          await manager.update(Transaction, transaction.id, {
            status: TransactionStatus.FAILED,
          });

          this.logger.log(
            `Payment failed: txn=${transaction.id} — sender debit reversed`,
          );
        }

        await manager.save(TransactionStateHistory, {
          transactionId: transaction.id,
          fromState: transaction.status,
          toState: payload.status,
          metadata: {
            webhookEventId: webhookEvent.id,
            providerReference: payload.reference,
          },
        });

        await manager.update(WebhookEvent, webhookEvent.id, {
          processed: true,
          processedAt: new Date(),
        });

        processedTransaction = transaction;
      });
    } catch (err) {
      this.logger.error(
        `Failed to process webhook ref=${payload.reference}: ${err.message}`,
        err.stack,
      );
      await this.webhookEventRepo.update(webhookEvent.id, { error: err.message }).catch(() => {});
      throw err;
    }

    if (!processedTransaction) return;

    await this.paymentsService.invalidatePaymentCaches();

    if (payload.status === 'completed') {
      this.eventEmitter.emit(
        'payment.completed',
        new PaymentCompletedEvent(
          processedTransaction.id,
          processedTransaction.recipientAccountId,
          processedTransaction.destinationAmount,
          processedTransaction.destinationCurrency,
          payload.reference,
        ),
      );
      this.auditService.audit({
        event: 'webhook.payment_completed',
        transactionId: processedTransaction.id,
        accountId: processedTransaction.recipientAccountId,
        amount: processedTransaction.destinationAmount,
        currency: processedTransaction.destinationCurrency,
        providerReference: payload.reference,
      });
    } else if (payload.status === 'failed') {
      this.eventEmitter.emit(
        'payment.failed',
        new PaymentFailedEvent(
          processedTransaction.id,
          payload.reference,
          'Provider reported failure',
        ),
      );
      this.auditService.audit({
        event: 'webhook.payment_failed',
        transactionId: processedTransaction.id,
        accountId: processedTransaction.senderAccountId,
        amount: processedTransaction.sourceAmount,
        providerReference: payload.reference,
      });
    }
  }

  private verifySignature(rawBody: Buffer, signature: string): boolean {
    if (!signature) return false;
    const secret = this.configService.get<string>('WEBHOOK_SECRET', 'webhook_secret_for_hmac_verification');
    try {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const expectedBuf = Buffer.from(expected, 'utf8');
      const receivedBuf = Buffer.from(signature, 'utf8');
      if (expectedBuf.length !== receivedBuf.length) return false;
      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }
}
