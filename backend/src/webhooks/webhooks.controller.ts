import {
  Controller,
  Post,
  Req,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { WEBHOOK_QUEUE, WEBHOOK_JOB_OPTIONS } from '../queue/queue.constants';
import type { WebhookJobData } from '../queue/webhook.processor';

@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue<WebhookJobData>,
  ) {}

  @Post('provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive provider webhook callback',
    description: 'Always returns 200. Processing is async via BullMQ queue.',
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    description: 'HMAC-SHA256(webhookSecret, rawRequestBody)',
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Always 200 — processing is async' })
  async handleProviderWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: WebhookPayloadDto,
    @Headers('x-webhook-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));

    this.logger.log(
      `Webhook received: ref=${payload.reference} status=${payload.status}`,
    );

    await this.webhookQueue.add(
      'process-webhook',
      {
        payload: payload as any,
        rawBody: rawBody.toString('base64'),
        signature: signature || '',
      },
      WEBHOOK_JOB_OPTIONS,
    );

    return { received: true };
  }
}
