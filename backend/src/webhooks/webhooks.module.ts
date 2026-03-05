import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { TransactionStateHistory } from '../payments/entities/transaction-state-history.entity';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsModule } from '../payments/payments.module';
import { WEBHOOK_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent, Transaction, TransactionStateHistory]),
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    LedgerModule,
    PaymentsModule,
  ],
  providers: [WebhooksService],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
