import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLedgerEntries1709000004 implements MigrationInterface {
  name = 'CreateLedgerEntries1709000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "entry_type_enum" AS ENUM ('debit', 'credit')
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id"             UUID              NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" UUID              NOT NULL,
        "account_id"     UUID              NOT NULL,
        "currency"       VARCHAR(3)        NOT NULL,
        "amount"         NUMERIC(20,8)     NOT NULL,
        "entry_type"     entry_type_enum   NOT NULL,
        "is_reversal"    BOOLEAN           NOT NULL DEFAULT false,
        "created_at"     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_entries_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id"),
        CONSTRAINT "FK_ledger_entries_account"     FOREIGN KEY ("account_id")     REFERENCES "accounts" ("id")
      )
    `);

    
    
    await queryRunner.query(`CREATE INDEX "IDX_ledger_transaction" ON "ledger_entries" ("transaction_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ledger_account"     ON "ledger_entries" ("account_id", "created_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TYPE "entry_type_enum"`);
  }
}
