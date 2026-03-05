import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../payments/entities/transaction.entity';
import { TransactionStateHistory } from '../payments/entities/transaction-state-history.entity';
import { WebhookEvent } from '../webhooks/entities/webhook-event.entity';
import { ProviderModule } from '../provider/provider.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsModule } from '../payments/payments.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ProviderProcessor } from './provider.processor';
import { WebhookProcessor } from './webhook.processor';
import { StuckPaymentScheduler } from './stuck-payment.scheduler';
import { DeadLetterHandler } from './dead-letter.handler';
import { PROVIDER_QUEUE, WEBHOOK_QUEUE } from './queue.constants';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: PROVIDER_QUEUE },
      { name: WEBHOOK_QUEUE },
    ),
    TypeOrmModule.forFeature([Transaction, TransactionStateHistory, WebhookEvent]),
    ProviderModule,
    LedgerModule,
    PaymentsModule,
    WebhooksModule,
  ],
  providers: [ProviderProcessor, WebhookProcessor, StuckPaymentScheduler, DeadLetterHandler],
})
export class QueueModule {}
