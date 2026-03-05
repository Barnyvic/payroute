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
  ) {}

  
  async processWebhook(
    payload: WebhookPayloadDto,
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    const signatureValid = this.verifySignature(rawBody, signature);

    
    let webhookEvent: WebhookEvent | null = null;
    try {
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

      webhookEvent = result[0];
    } catch (err) {
      this.logger.error(`Failed to log webhook event: ${err.message}`);
      return;
    }

    
    if (!signatureValid) {
      this.logger.warn(
        `Invalid signature for ref=${payload.reference} — logged but not processed`,
      );
      await this.webhookEventRepo.update(webhookEvent.id, { error: 'Invalid HMAC signature' });
      return;
    }

    
    const transaction = await this.transactionRepo.findOne({
      where: { providerReference: payload.reference },
    });

    if (!transaction) {
      this.logger.warn(`Unknown provider reference: ${payload.reference}`);
      await this.webhookEventRepo.update(webhookEvent.id, {
        error: `No transaction found for provider reference ${payload.reference}`,
      });
      return;
    }

    
    try {
      this.paymentsService.validateTransition(
        transaction.status,
        payload.status as TransactionStatus,
      );
    } catch (err) {
      this.logger.warn(
        `Invalid transition for txn=${transaction.id}: ${transaction.status} → ${payload.status}`,
      );
      await this.webhookEventRepo.update(webhookEvent.id, { error: err.message });
      return;
    }

    
    try {
      await this.dataSource.transaction(async (manager) => {
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
      });

      
      if (payload.status === 'completed') {
        this.eventEmitter.emit(
          'payment.completed',
          new PaymentCompletedEvent(
            transaction.id,
            transaction.recipientAccountId,
            transaction.destinationAmount,
            transaction.destinationCurrency,
            payload.reference,
          ),
        );
      } else if (payload.status === 'failed') {
        this.eventEmitter.emit(
          'payment.failed',
          new PaymentFailedEvent(
            transaction.id,
            payload.reference,
            `Provider reported failure`,
          ),
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to process webhook for txn=${transaction.id}: ${err.message}`,
        err.stack,
      );
      await this.webhookEventRepo.update(webhookEvent.id, { error: err.message });
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
