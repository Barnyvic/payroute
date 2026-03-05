import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { FxQuote } from '../../fx/entities/fx-quote.entity';

export enum TransactionStatus {
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}


export const VALID_TRANSITIONS: Partial<Record<TransactionStatus, TransactionStatus[]>> = {
  [TransactionStatus.INITIATED]:  [TransactionStatus.PROCESSING, TransactionStatus.FAILED],
  [TransactionStatus.PROCESSING]: [TransactionStatus.COMPLETED, TransactionStatus.FAILED],
  [TransactionStatus.FAILED]:     [TransactionStatus.REVERSED],
  [TransactionStatus.COMPLETED]:  [TransactionStatus.REVERSED],
  [TransactionStatus.REVERSED]:   [],
};

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_reference', length: 255, nullable: true, default: null })
  providerReference: string | null;

  @Column({ name: 'sender_account_id' })
  senderAccountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'sender_account_id' })
  senderAccount: Account;

  @Column({ name: 'recipient_account_id' })
  recipientAccountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'recipient_account_id' })
  recipientAccount: Account;

  @Column({ name: 'source_currency', length: 3 })
  sourceCurrency: string;

  @Column({ name: 'source_amount', type: 'numeric', precision: 20, scale: 8 })
  sourceAmount: string;

  @Column({ name: 'destination_currency', length: 3 })
  destinationCurrency: string;

  @Column({ name: 'destination_amount', type: 'numeric', precision: 20, scale: 8 })
  destinationAmount: string;

  @Column({ name: 'fx_rate', type: 'numeric', precision: 16, scale: 8 })
  fxRate: string;

  @Column({ name: 'fx_quote_id' })
  fxQuoteId: string;

  @ManyToOne(() => FxQuote)
  @JoinColumn({ name: 'fx_quote_id' })
  fxQuote: FxQuote;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', nullable: true, default: null })
  completedAt: Date | null;
}
