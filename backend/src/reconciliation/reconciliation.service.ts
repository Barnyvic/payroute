import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ReconciliationMismatch {
  accountId: string;
  storedBalance: string;
  ledgerSum: string;
  difference: string;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async runLedgerVsBalanceCheck(): Promise<{ ok: boolean; mismatches: ReconciliationMismatch[] }> {
    const rows = await this.dataSource.query<
      { account_id: string; stored_balance: string; ledger_sum: string }[]
    >(
      `SELECT a.id AS account_id,
              a.balance AS stored_balance,
              COALESCE(SUM(l.amount::NUMERIC), 0)::TEXT AS ledger_sum
         FROM accounts a
         LEFT JOIN ledger_entries l ON l.account_id = a.id
        GROUP BY a.id, a.balance
       HAVING a.balance::TEXT != COALESCE(SUM(l.amount::NUMERIC), 0)::TEXT`,
    );

    const mismatches: ReconciliationMismatch[] = (rows || []).map((r) => {
      const stored = parseFloat(r.stored_balance);
      const sum = parseFloat(r.ledger_sum);
      return {
        accountId: r.account_id,
        storedBalance: r.stored_balance,
        ledgerSum: r.ledger_sum,
        difference: (stored - sum).toFixed(8),
      };
    });

    if (mismatches.length > 0) {
      this.logger.error(
        `Reconciliation failed: ${mismatches.length} account(s) with balance != SUM(ledger_entries)`,
      );
      mismatches.forEach((m) =>
        this.logger.error(
          `accountId=${m.accountId} stored=${m.storedBalance} ledgerSum=${m.ledgerSum} diff=${m.difference}`,
        ),
      );
    } else {
      this.logger.log('Reconciliation passed: all account balances match ledger sum');
    }

    return { ok: mismatches.length === 0, mismatches };
  }
}
