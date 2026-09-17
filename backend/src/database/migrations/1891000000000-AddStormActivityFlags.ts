import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStormActivityFlags1891000000000 implements MigrationInterface {
  name = 'AddStormActivityFlags1891000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "storms"
      ADD COLUMN "isActive" boolean NOT NULL DEFAULT false,
      ADD COLUMN "lastSeenInFeedAt" timestamptz
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_storms_active_last_seen"
      ON "storms" ("isActive", "lastSeenInFeedAt" DESC)
    `);

    /*
     * Backfill: existing rows are marked inactive. The next ingestion
     * run will set the correct active set based on the real feed.
     *
     * We deliberately do NOT guess activity from lastSeenAt — the whole
     * point of this migration is to stop inferring and start using
     * NOAA's explicit signal.
     */
    await queryRunner.query(`
      UPDATE "storms"
      SET "isActive" = false,
          "lastSeenInFeedAt" = NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_storms_active_last_seen"`,
    );
    await queryRunner.query(`
      ALTER TABLE "storms"
      DROP COLUMN IF EXISTS "isActive",
      DROP COLUMN IF EXISTS "lastSeenInFeedAt"
    `);
  }
}
