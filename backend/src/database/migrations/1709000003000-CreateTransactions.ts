import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransactions1709000003000 implements MigrationInterface {
  name = 'CreateTransactions1709000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "transaction_status_enum" AS ENUM (
        'initiated',
        'processing',
        'completed',
        'failed',
        'reversed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id"                   UUID                     NOT NULL DEFAULT gen_random_uuid(),
        "provider_reference"   VARCHAR(255),
        "sender_account_id"    UUID                     NOT NULL,
        "recipient_account_id" UUID                     NOT NULL,
        "source_currency"      VARCHAR(3)               NOT NULL,
        "source_amount"        NUMERIC(20,8)            NOT NULL,
        "destination_currency" VARCHAR(3)               NOT NULL,
        "destination_amount"   NUMERIC(20,8)            NOT NULL,
        "fx_rate"              NUMERIC(16,8)            NOT NULL,
        "fx_quote_id"          UUID                     NOT NULL,
        "status"               transaction_status_enum  NOT NULL DEFAULT 'initiated',
        "created_at"           TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
        "completed_at"         TIMESTAMPTZ,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_sender"    FOREIGN KEY ("sender_account_id")    REFERENCES "accounts" ("id"),
        CONSTRAINT "FK_transactions_recipient" FOREIGN KEY ("recipient_account_id") REFERENCES "accounts" ("id"),
        CONSTRAINT "FK_transactions_fx_quote"  FOREIGN KEY ("fx_quote_id")          REFERENCES "fx_quotes" ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_transactions_provider_ref"  ON "transactions" ("provider_reference")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_status_created" ON "transactions" ("status", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_sender"         ON "transactions" ("sender_account_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_recipient"      ON "transactions" ("recipient_account_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
  }
}
