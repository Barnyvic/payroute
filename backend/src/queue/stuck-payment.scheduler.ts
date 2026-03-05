import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PaymentsService } from '../payments/payments.service';
import { PROVIDER_QUEUE, PROVIDER_JOB_OPTIONS } from './queue.constants';
import type { ProviderJobData } from './provider.processor';

const STUCK_THRESHOLD_MINUTES = 30;
const MAX_RETRY_AGE_HOURS = 24;

@Injectable()
export class StuckPaymentScheduler {
  private readonly logger = new Logger(StuckPaymentScheduler.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    @InjectQueue(PROVIDER_QUEUE)
    private readonly providerQueue: Queue<ProviderJobData>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryStuckPayments(): Promise<void> {
    const stuckPayments = await this.paymentsService.findStuck(STUCK_THRESHOLD_MINUTES);

    if (stuckPayments.length === 0) return;

    this.logger.log(`Found ${stuckPayments.length} stuck payment(s) — evaluating for retry`);

    const maxAgeMs = MAX_RETRY_AGE_HOURS * 60 * 60 * 1_000;
    const cutoff = new Date(Date.now() - maxAgeMs);
    let enqueued = 0;
    let tooOld = 0;
    let skippedActive = 0;

    for (const txn of stuckPayments) {
      if (txn.createdAt < cutoff) {
        tooOld++;
        this.logger.warn(
          `Skipping txn=${txn.id} — stuck for >${MAX_RETRY_AGE_HOURS}h, needs manual intervention`,
        );
        continue;
      }

      const existingJob = await this.providerQueue.getJob(`retry-${txn.id}`);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'active' || state === 'waiting' || state === 'delayed') {
          skippedActive++;
          this.logger.debug(`Skipping txn=${txn.id} — retry job already ${state}`);
          continue;
        }
        await existingJob.remove().catch(() => {});
      }

      await this.providerQueue.add(
        'submit-to-provider',
        {
          transactionId: txn.id,
          sourceAmount: txn.sourceAmount,
          sourceCurrency: txn.sourceCurrency,
          destinationCurrency: txn.destinationCurrency,
          senderAccountId: txn.senderAccountId,
          idempotencyKey: `retry-${txn.id}`,
        },
        {
          ...PROVIDER_JOB_OPTIONS,
          jobId: `retry-${txn.id}`,
        },
      );

      enqueued++;
    }

    this.logger.log(
      `Stuck payment sweep complete: enqueued=${enqueued} skipped_active=${skippedActive} skipped_too_old=${tooOld}`,
    );
  }
}
