import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity';
import { WebhookEvent } from '../webhooks/entities/webhook-event.entity';

@Injectable()
export class RetentionScheduler {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepo: Repository<IdempotencyKey>,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredIdempotencyKeys(): Promise<void> {
    const result = await this.idempotencyRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .execute();
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(`Retention: deleted ${deleted} expired idempotency key(s)`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldProcessedWebhookEvents(): Promise<void> {
    const retentionDays = this.configService.get<number>('WEBHOOK_EVENTS_RETENTION_DAYS', 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.webhookEventRepo
      .createQueryBuilder()
      .delete()
      .where('processed = :processed', { processed: true })
      .andWhere('received_at < :cutoff', { cutoff })
      .execute();
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(
        `Retention: deleted ${deleted} processed webhook event(s) older than ${retentionDays} days`,
      );
    }
  }
}
