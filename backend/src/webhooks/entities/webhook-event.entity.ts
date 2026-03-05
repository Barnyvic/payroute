import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_reference', length: 255 })
  providerReference: string;

  @Column({ name: 'event_type', length: 50 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ nullable: true, default: null })
  signature: string | null;

  @Column({ name: 'signature_valid', nullable: true, default: null })
  signatureValid: boolean | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;

  @Column({ default: false })
  processed: boolean;

  @Column({ name: 'processed_at', nullable: true, default: null })
  processedAt: Date | null;

  @Column({ nullable: true, default: null, type: 'text' })
  error: string | null;
}
