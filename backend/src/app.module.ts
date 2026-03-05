import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AccountsModule } from './accounts/accounts.module';
import { LedgerModule } from './ledger/ledger.module';
import { FxModule } from './fx/fx.module';
import { ProviderModule } from './provider/provider.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { EventsModule } from './events/events.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    
    ThrottlerModule.forRoot([
      { name: 'global',   ttl: 15 * 60 * 1000, limit: 200 },
      { name: 'payments', ttl:      60 * 1000,  limit: 20  },
      { name: 'strict',   ttl:      60 * 1000,  limit: 5   },
    ]),

    
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    DatabaseModule,
    RedisModule,
    AccountsModule,
    LedgerModule,
    FxModule,
    ProviderModule,
    PaymentsModule,
    WebhooksModule,
    EventsModule,
    QueueModule,
  ],
  providers: [
    
    
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
