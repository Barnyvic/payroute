import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdempotencyKeys1709000007000 implements MigrationInterface {
  name = 'CreateIdempotencyKeys1709000007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "key"           VARCHAR(255) NOT NULL,
        "response_body" JSONB,
        "status_code"   INTEGER,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "expires_at"    TIMESTAMPTZ  NOT NULL,
        CONSTRAINT "PK_idempotency_keys" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_idempotency_expires" ON "idempotency_keys" ("expires_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}
