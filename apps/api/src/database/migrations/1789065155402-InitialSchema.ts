import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789065155402 implements MigrationInterface {
    name = 'InitialSchema1789065155402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "storms" ("atcfId" character varying NOT NULL, "name" character varying, "basin" character varying NOT NULL, "firstSeenAt" TIMESTAMP NOT NULL DEFAULT now(), "lastSeenAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_60aa40f5912ebd5e85a76d003d5" PRIMARY KEY ("atcfId"))`);
        await queryRunner.query(`CREATE TABLE "forecast_points" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "validAt" TIMESTAMP WITH TIME ZONE NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "windSpeedKt" integer, "pressureMb" integer, "category" integer, "advisory_id" uuid, CONSTRAINT "PK_25e45b20b89a7a179e204e63fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "advisories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "advisoryNumber" integer NOT NULL, "issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "rawText" text, "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(), "storm_atcf_id" character varying, CONSTRAINT "UQ_4acde25d57858b1ece4620ef2a4" UNIQUE ("storm_atcf_id", "advisoryNumber"), CONSTRAINT "PK_d7296456a2d94b0ec905412c5b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "forecast_points" ADD CONSTRAINT "FK_68a87aa2d5561d6d3fd12e8616f" FOREIGN KEY ("advisory_id") REFERENCES "advisories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "advisories" ADD CONSTRAINT "FK_58653065c7638c7a83315a46b22" FOREIGN KEY ("storm_atcf_id") REFERENCES "storms"("atcfId") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advisories" DROP CONSTRAINT "FK_58653065c7638c7a83315a46b22"`);
        await queryRunner.query(`ALTER TABLE "forecast_points" DROP CONSTRAINT "FK_68a87aa2d5561d6d3fd12e8616f"`);
        await queryRunner.query(`DROP TABLE "advisories"`);
        await queryRunner.query(`DROP TABLE "forecast_points"`);
        await queryRunner.query(`DROP TABLE "storms"`);
    }

}
