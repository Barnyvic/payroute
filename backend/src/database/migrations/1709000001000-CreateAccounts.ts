import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccounts1709000001000 implements MigrationInterface {
  name = 'CreateAccounts1709000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    VARCHAR(255)  NOT NULL,
        "currency"   VARCHAR(3)    NOT NULL,
        "balance"    NUMERIC(20,8) NOT NULL DEFAULT 0,
        "version"    INTEGER       NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_accounts_balance_non_negative" CHECK ("balance" >= 0),
        CONSTRAINT "UQ_accounts_user_currency" UNIQUE ("user_id", "currency")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_accounts_user_id" ON "accounts" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounts_currency" ON "accounts" ("currency")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "accounts"`);
  }
}
