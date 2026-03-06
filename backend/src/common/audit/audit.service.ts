import { Injectable, Logger } from '@nestjs/common';

export interface AuditPayload {
  event: string;
  transactionId?: string;
  accountId?: string;
  userId?: string;
  amount?: string;
  currency?: string;
  status?: string;
  [key: string]: unknown;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  audit(payload: AuditPayload): void {
    const entry = {
      timestamp: new Date().toISOString(),
      ...payload,
    };
    this.logger.log(JSON.stringify(entry));
  }
}
