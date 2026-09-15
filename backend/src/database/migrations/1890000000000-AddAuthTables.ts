import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthTables1890000000000 implements MigrationInterface {
  name = 'AddAuthTables1890000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'client', "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "phone" character varying, "passwordHash" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "tokenHash" character varying NOT NULL, "prefix" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "userId" uuid, CONSTRAINT "UQ_6a4dbd91c2d18b701e515a3d1f4" UNIQUE ("tokenHash"), CONSTRAINT "PK_6a4dbd91c2d18b701e515a3d1f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_tokens" ADD CONSTRAINT "FK_5f6f6f6f6f6f6f6f6f6f6f6f6f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_tokens" DROP CONSTRAINT "FK_5f6f6f6f6f6f6f6f6f6f6f6f6f"`,
    );
    await queryRunner.query(`DROP TABLE "api_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}