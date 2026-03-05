import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ length: 255 })
  key: string;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true, default: null })
  responseBody: Record<string, unknown> | null;

  @Column({ name: 'status_code', nullable: true, default: null })
  statusCode: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;
}
