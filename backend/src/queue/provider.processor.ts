import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transaction, TransactionStatus } from '../payments/entities/transaction.entity';
import { ProviderService } from '../provider/provider.service';
import { PaymentInitiatedEvent } from '../events/payment.events';
import { PROVIDER_QUEUE } from './queue.constants';

export interface ProviderJobData {
  transactionId: string;
  sourceAmount: string;
  sourceCurrency: string;
  destinationCurrency: string;
  senderAccountId: string;
  idempotencyKey: string;
}

@Processor(PROVIDER_QUEUE)
export class ProviderProcessor extends WorkerHost {
  private readonly logger = new Logger(ProviderProcessor.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly providerService: ProviderService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<ProviderJobData>): Promise<void> {
    const { transactionId, sourceAmount, sourceCurrency, destinationCurrency, senderAccountId, idempotencyKey } = job.data;

    const txn = await this.transactionRepo.findOne({ where: { id: transactionId } });

    if (!txn || txn.status !== TransactionStatus.PROCESSING) {
      this.logger.warn(
        `Skipping provider submission: txn=${transactionId} status=${txn?.status ?? 'NOT_FOUND'} — no longer eligible`,
      );
      return;
    }

    if (txn.providerReference) {
      this.logger.warn(
        `Skipping provider submission: txn=${transactionId} already has ref=${txn.providerReference}`,
      );
      return;
    }

    this.logger.log(
      `[attempt ${job.attemptsMade + 1}/${job.opts.attempts}] Submitting txn=${transactionId} to provider`,
    );

    const { providerReference } = await this.providerService.submitPayment(
      transactionId,
      sourceAmount,
      sourceCurrency,
    );

    await this.transactionRepo.update(transactionId, { providerReference });

    this.logger.log(
      `Provider submission succeeded: txn=${transactionId} ref=${providerReference}`,
    );

    this.eventEmitter.emit(
      'payment.initiated',
      new PaymentInitiatedEvent(
        transactionId,
        senderAccountId,
        sourceAmount,
        sourceCurrency,
        destinationCurrency,
        idempotencyKey,
      ),
    );
  }
}
