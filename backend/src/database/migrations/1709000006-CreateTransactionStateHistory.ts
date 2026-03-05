import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransactionStateHistory1709000006 implements MigrationInterface {
  name = 'CreateTransactionStateHistory1709000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transaction_state_history" (
        "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" UUID        NOT NULL,
        "from_state"     VARCHAR(50),
        "to_state"       VARCHAR(50) NOT NULL,
        "timestamp"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "metadata"       JSONB,
        CONSTRAINT "PK_transaction_state_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_state_history_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_state_history_txn" ON "transaction_state_history" ("transaction_id", "timestamp")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transaction_state_history"`);
  }
}
