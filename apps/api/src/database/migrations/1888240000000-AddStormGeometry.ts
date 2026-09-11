import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStormGeometry1888240000000 implements MigrationInterface {
  name = 'AddStormGeometry1888240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(
      `ALTER TABLE "advisories" ADD COLUMN "track" geography(LineString,4326)`,
    );
    await queryRunner.query(
      `ALTER TABLE "advisories" ADD COLUMN "cone" geography(Polygon,4326)`,
    );
    await queryRunner.query(
      `CREATE TABLE "warnings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "warningType" character varying NOT NULL, "geometry" geography(LineString,4326) NOT NULL, "advisory_id" uuid, CONSTRAINT "PK_9a9a2f0c1a8f4b7f3d2a4b5c6d7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "warnings" ADD CONSTRAINT "FK_8b4f2a1c3d5e6f7a8b9c0d1e2f3a" FOREIGN KEY ("advisory_id") REFERENCES "advisories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "warnings" DROP CONSTRAINT "FK_8b4f2a1c3d5e6f7a8b9c0d1e2f3a"`,
    );
    await queryRunner.query(`DROP TABLE "warnings"`);
    await queryRunner.query(`ALTER TABLE "advisories" DROP COLUMN "cone"`);
    await queryRunner.query(`ALTER TABLE "advisories" DROP COLUMN "track"`);
  }
}
