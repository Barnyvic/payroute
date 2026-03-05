import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface ProviderSubmitResult {
  providerReference: string;
}


@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  async submitPayment(transactionId: string, amount: string, currency: string): Promise<ProviderSubmitResult> {
    
    await new Promise((r) => setTimeout(r, 50));

    const providerReference = `prov_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    this.logger.log(
      `Payment submitted to provider: txn=${transactionId} ref=${providerReference} amount=${amount} ${currency}`,
    );

    return { providerReference };
  }
}
