import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('fx_quotes')
export class FxQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'from_currency', length: 3 })
  fromCurrency: string;

  @Column({ name: 'to_currency', length: 3 })
  toCurrency: string;

  @Column({ type: 'numeric', precision: 16, scale: 8 })
  rate: string;

  @Column({ name: 'source_amount', type: 'numeric', precision: 20, scale: 8 })
  sourceAmount: string;

  @Column({ name: 'destination_amount', type: 'numeric', precision: 20, scale: 8 })
  destinationAmount: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}
