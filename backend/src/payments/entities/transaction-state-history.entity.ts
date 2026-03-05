import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity('transaction_state_history')
export class TransactionStateHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;

  @Column({ name: 'from_state', nullable: true, default: null })
  fromState: string | null;

  @Column({ name: 'to_state' })
  toState: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true, default: null })
  metadata: Record<string, unknown> | null;
}
