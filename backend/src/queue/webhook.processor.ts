import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WEBHOOK_QUEUE } from './queue.constants';

export interface WebhookJobData {
  payload: { reference: string; status: string; [key: string]: unknown };
  rawBody: string;
  signature: string;
}

@Processor(WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { payload, rawBody, signature } = job.data;

    this.logger.log(
      `[attempt ${job.attemptsMade + 1}/${job.opts.attempts}] Processing webhook ref=${payload.reference} status=${payload.status}`,
    );

    await this.webhooksService.processWebhook(
      payload as any,
      Buffer.from(rawBody, 'base64'),
      signature,
    );

    this.logger.log(`Webhook processed: ref=${payload.reference}`);
  }
}
