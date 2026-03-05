import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookEvents1709000005000 implements MigrationInterface {
  name = 'CreateWebhookEvents1709000005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
        "provider_reference" VARCHAR(255) NOT NULL,
        "event_type"         VARCHAR(50)  NOT NULL,
        "payload"            JSONB        NOT NULL,
        "signature"          VARCHAR(255),
        "signature_valid"    BOOLEAN,
        "received_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "processed"          BOOLEAN      NOT NULL DEFAULT false,
        "processed_at"       TIMESTAMPTZ,
        "error"              TEXT,
        CONSTRAINT "PK_webhook_events" PRIMARY KEY ("id")
      )
    `);

    
    
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_webhook_events_ref_type"
        ON "webhook_events" ("provider_reference", "event_type")
    `);

    await queryRunner.query(`CREATE INDEX "IDX_webhook_events_processed" ON "webhook_events" ("processed", "received_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_events_ref"        ON "webhook_events" ("provider_reference")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_events"`);
  }
}
