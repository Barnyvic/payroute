import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface ProviderSubmitResult {
  providerReference: string;
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);
  private readonly webhookSecret: string;
  private readonly backendBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.get<string>(
      'WEBHOOK_SECRET',
      'webhook_secret_for_hmac_verification',
    );
    this.backendBaseUrl = this.configService.get<string>(
      'PROVIDER_CALLBACK_URL',
      'http://localhost:3000',
    );
  }

  async submitPayment(transactionId: string, amount: string, currency: string): Promise<ProviderSubmitResult> {
    await new Promise((r) => setTimeout(r, 50));

    const providerReference = `prov_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    this.logger.log(
      `Payment submitted to provider: txn=${transactionId} ref=${providerReference} amount=${amount} ${currency}`,
    );

    this.scheduleCallback(providerReference, amount, currency);

    return { providerReference };
  }

  private scheduleCallback(reference: string, amount: string, currency: string): void {
    const delayMs = 2_000 + Math.random() * 3_000;

    setTimeout(async () => {
      const payload = JSON.stringify({
        reference,
        status: 'completed',
        amount: parseFloat(amount),
        currency,
        timestamp: new Date().toISOString(),
      });

      const signature = createHmac('sha256', this.webhookSecret)
        .update(Buffer.from(payload))
        .digest('hex');

      try {
        const res = await fetch(`${this.backendBaseUrl}/api/webhooks/provider`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
          },
          body: payload,
        });

        this.logger.log(
          `Simulated provider callback: ref=${reference} status=completed httpStatus=${res.status}`,
        );
      } catch (err) {
        this.logger.warn(
          `Simulated provider callback failed: ref=${reference} error=${err.message}`,
        );
      }
    }, delayMs);
  }
}
