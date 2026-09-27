import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokens1893000000000
  implements MigrationInterface
{
  name = 'AddPasswordResetTokens1893000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_2a1e77bc73d1e3b3c1a3a1c4e5f" PRIMARY KEY ("id"), CONSTRAINT "IDX_5b2c0d4e1f2a3b4c5d6e7f8a9b0" UNIQUE ("tokenHash"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_9d3f2a1b4c5d6e7f8a9b0c1d2e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_9d3f2a1b4c5d6e7f8a9b0c1d2e"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
  }
}
