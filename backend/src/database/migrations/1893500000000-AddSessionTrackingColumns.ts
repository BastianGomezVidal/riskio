import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restores the session-tracking columns that the entity has carried for a
 * while but that no committed migration ever created.
 *
 * A migration named `AddSessionTracking1700000000000` is recorded in the
 * `migrations` table of the development database, but its source has never
 * existed in this repository — not in the working tree, not in any commit. The
 * columns were therefore only ever created by that lost migration, which means
 * a database built from the migrations in this repo would come out without
 * them and every login would fail on the missing column.
 *
 * The statements use IF NOT EXISTS on purpose: this migration is a no-op on any
 * database where the lost one already ran, and creates the columns on a fresh
 * one. The name deliberately differs from the lost migration, because its
 * timestamp (1700000000000) sorts *before* InitialSchema and would fail on a
 * database that has no `users` table yet.
 */
export class AddSessionTrackingColumns1893500000000
  implements MigrationInterface
{
  name = 'AddSessionTrackingColumns1893500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginBrowser" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginOs" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currentSessionId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "currentSessionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "lastLoginOs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "lastLoginBrowser"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "lastLoginAt"`,
    );
  }
}
