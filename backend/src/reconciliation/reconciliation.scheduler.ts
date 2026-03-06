import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReconciliationService } from './reconciliation.service';

@Injectable()
export class ReconciliationScheduler {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runReconciliation(): Promise<void> {
    this.logger.log('Running scheduled ledger vs balance reconciliation');
    await this.reconciliationService.runLedgerVsBalanceCheck();
  }
}
