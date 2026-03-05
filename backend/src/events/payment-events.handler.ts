import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PaymentInitiatedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentRefundedEvent,
} from './payment.events';

@Injectable()
export class PaymentEventsHandler {
  private readonly logger = new Logger(PaymentEventsHandler.name);

  @OnEvent('payment.initiated', { async: true })
  async handlePaymentInitiated(event: PaymentInitiatedEvent): Promise<void> {
    this.logger.log(
      `[payment.initiated] txn=${event.transactionId} amount=${event.sourceAmount} ${event.sourceCurrency}→${event.destinationCurrency}`,
    );
  }

  @OnEvent('payment.completed', { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    this.logger.log(
      `[payment.completed] txn=${event.transactionId} credited=${event.destinationAmount} ${event.destinationCurrency} ref=${event.providerReference}`,
    );
  }

  @OnEvent('payment.failed', { async: true })
  async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    this.logger.log(
      `[payment.failed] txn=${event.transactionId} reason="${event.reason}" ref=${event.providerReference}`,
    );
  }

  @OnEvent('payment.refunded', { async: true })
  async handlePaymentRefunded(event: PaymentRefundedEvent): Promise<void> {
    this.logger.log(
      `[payment.refunded] txn=${event.transactionId} reason="${event.reason}"`,
    );
  }
}
