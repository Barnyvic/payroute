import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFxQuotes1709000002000 implements MigrationInterface {
  name = 'CreateFxQuotes1709000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fx_quotes" (
        "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
        "from_currency"    VARCHAR(3)    NOT NULL,
        "to_currency"      VARCHAR(3)    NOT NULL,
        "rate"             NUMERIC(16,8) NOT NULL,
        "source_amount"    NUMERIC(20,8) NOT NULL,
        "destination_amount" NUMERIC(20,8) NOT NULL,
        "expires_at"       TIMESTAMPTZ   NOT NULL,
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_fx_quotes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_fx_quotes_rate_positive" CHECK ("rate" > 0),
        CONSTRAINT "CHK_fx_quotes_expiry" CHECK ("expires_at" > "created_at")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_fx_quotes_currencies" ON "fx_quotes" ("from_currency", "to_currency")`);
    await queryRunner.query(`CREATE INDEX "IDX_fx_quotes_expires_at" ON "fx_quotes" ("expires_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fx_quotes"`);
  }
}
