import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Transaction } from './entities/transaction.entity';
import { TransactionStateHistory } from './entities/transaction-state-history.entity';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { FxModule } from '../fx/fx.module';
import { PROVIDER_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionStateHistory,
      LedgerEntry,
      IdempotencyKey,
    ]),
    BullModule.registerQueue({ name: PROVIDER_QUEUE }),
    AccountsModule,
    LedgerModule,
    FxModule,
  ],
  providers: [PaymentsService, IdempotencyInterceptor],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
