import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { LedgerEntry, EntryType } from './entities/ledger-entry.entity';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  async debit(
    accountId: string,
    amount: string,
    transactionId: string,
    manager: EntityManager,
  ): Promise<LedgerEntry> {
    const account = await manager.findOne(Account, { where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);

    const entry = manager.create(LedgerEntry, {
      transactionId,
      accountId,
      currency: account.currency,
      amount: `-${amount}`,
      entryType: EntryType.DEBIT,
      isReversal: false,
    });
    await manager.save(LedgerEntry, entry);

    const result = await manager.query<{ balance: string }[]>(
      `UPDATE accounts
         SET balance    = balance - $1::NUMERIC,
             version    = version + 1,
             updated_at = NOW()
       WHERE id = $2
         AND balance >= $1::NUMERIC
       RETURNING balance`,
      [amount, accountId],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException(
        'Insufficient balance — the debit could not be applied',
      );
    }

    this.logger.log(
      `Debit applied: account=${accountId} amount=-${amount} txn=${transactionId} new_balance=${result[0].balance}`,
    );

    return entry;
  }

  async credit(
    accountId: string,
    amount: string,
    transactionId: string,
    manager: EntityManager,
  ): Promise<LedgerEntry> {
    const account = await manager.findOne(Account, { where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);

    const entry = manager.create(LedgerEntry, {
      transactionId,
      accountId,
      currency: account.currency,
      amount: `${amount}`,
      entryType: EntryType.CREDIT,
      isReversal: false,
    });
    await manager.save(LedgerEntry, entry);

    const result = await manager.query<{ balance: string }[]>(
      `UPDATE accounts
         SET balance    = balance + $1::NUMERIC,
             version    = version + 1,
             updated_at = NOW()
       WHERE id = $2
       RETURNING balance`,
      [amount, accountId],
    );

    this.logger.log(
      `Credit applied: account=${accountId} amount=+${amount} txn=${transactionId} new_balance=${result[0].balance}`,
    );

    return entry;
  }

  async createCompensatingEntries(
    transactionId: string,
    manager: EntityManager,
  ): Promise<LedgerEntry[]> {
    const originalDebits = await manager.find(LedgerEntry, {
      where: { transactionId, entryType: EntryType.DEBIT, isReversal: false },
    });

    if (originalDebits.length === 0) {
      this.logger.warn(`No debit entries found for transaction ${transactionId} — nothing to reverse`);
      return [];
    }

    const compensating: LedgerEntry[] = [];

    for (const debit of originalDebits) {
      const reversalAmount = debit.amount.replace('-', '').trim();

      const entry = manager.create(LedgerEntry, {
        transactionId,
        accountId: debit.accountId,
        currency: debit.currency,
        amount: reversalAmount,
        entryType: EntryType.CREDIT,
        isReversal: true,
      });
      await manager.save(LedgerEntry, entry);

      await manager.query(
        `UPDATE accounts
           SET balance    = balance + $1::NUMERIC,
               version    = version + 1,
               updated_at = NOW()
         WHERE id = $2`,
        [reversalAmount, debit.accountId],
      );

      this.logger.log(
        `Compensating entry applied: account=${debit.accountId} reversal=+${reversalAmount} txn=${transactionId}`,
      );

      compensating.push(entry);
    }

    return compensating;
  }

  
  async hasBeenReversed(transactionId: string, manager: EntityManager): Promise<boolean> {
    const count = await manager.count(LedgerEntry, {
      where: { transactionId, isReversal: true },
    });
    return count > 0;
  }

  async findByTransactionId(
    transactionId: string,
    manager: EntityManager,
  ): Promise<LedgerEntry[]> {
    return manager.find(LedgerEntry, {
      where: { transactionId },
      order: { createdAt: 'ASC' },
    });
  }
}
