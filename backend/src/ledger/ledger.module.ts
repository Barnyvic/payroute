import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerService } from './ledger.service';
import { Account } from '../accounts/entities/account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry, Account])],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
