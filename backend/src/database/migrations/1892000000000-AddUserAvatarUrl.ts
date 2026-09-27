import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarUrl1892000000000 implements MigrationInterface {
  name = 'AddUserAvatarUrl1892000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatarUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
  }
}