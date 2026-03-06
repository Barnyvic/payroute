import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputedStatus1709000008000 implements MigrationInterface {
  name = 'AddDisputedStatus1709000008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TYPE "transaction_status_enum" ADD VALUE 'disputed';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM transaction_state_history WHERE to_state = 'disputed' OR from_state = 'disputed';
    `);
    await queryRunner.query(`
      ALTER TYPE transaction_status_enum RENAME TO transaction_status_enum_old;
      CREATE TYPE transaction_status_enum AS ENUM ('initiated', 'processing', 'completed', 'failed', 'reversed');
      ALTER TABLE transactions
        ALTER COLUMN status TYPE transaction_status_enum
        USING (status::text::transaction_status_enum);
      DROP TYPE transaction_status_enum_old;
    `);
  }
}
