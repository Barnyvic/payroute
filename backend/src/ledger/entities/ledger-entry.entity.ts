import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';

export enum EntryType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ name: 'account_id' })
  accountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ length: 3 })
  currency: string;

  
  
  @Column({ type: 'numeric', precision: 20, scale: 8 })
  amount: string;

  @Column({ name: 'entry_type', type: 'enum', enum: EntryType })
  entryType: EntryType;

  @Column({ name: 'is_reversal', default: false })
  isReversal: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
