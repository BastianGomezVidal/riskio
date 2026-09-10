import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from '../../src/app.controller.js';
import { AppService } from '../../src/app.service.js';
import { StormsModule } from '../../src/storms/storms.module.js';
import { AdvisoriesModule } from '../../src/advisories/advisories.module.js';
import { ForecastPointsModule } from '../../src/forecast-points/forecast-points.module.js';
import { IngestionModule } from '../../src/ingestion/ingestion.module.js';
import { HealthModule } from '../../src/health/health.module.js';
import { InitialSchema1789065155402 } from '../../src/database/migrations/1789065155402-InitialSchema.js';
import { TEST_DATABASE_URL } from '../setup-integration.js';
import { StormsService } from '../../src/storms/storms.service.js';
import { AdvisoriesService } from '../../src/advisories/advisories.service.js';
import { ForecastPointsService } from '../../src/forecast-points/forecast-points.service.js';

export interface ProviderOverride<T> {
  provide: unknown;
  useValue: T;
}

/**
 * Builds the full application against the dedicated integration test database,
 * configured the same way as production (migrations, validation pipe, etc.).
 * Optional `overrides` lets tests swap external providers (e.g. NhcProvider).
 */
export async function createTestApp(
  overrides: ProviderOverride<unknown>[] = [],
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: TEST_DATABASE_URL,
        autoLoadEntities: true,
        synchronize: false,
        migrations: [InitialSchema1789065155402],
        migrationsRun: true,
        logging: false,
      }),
      ScheduleModule.forRoot(),
      StormsModule,
      AdvisoriesModule,
      ForecastPointsModule,
      IngestionModule,
      HealthModule,
    ],
    controllers: [AppController],
    providers: [AppService],
  });

  for (const { provide, useValue } of overrides) {
    builder.overrideProvider(provide).useValue(useValue);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

export interface StormSeed {
  atcfId: string;
  name: string | null;
  basin: string;
}

export interface AdvisorySeed {
  advisoryNumber: number;
  issuedAt: Date;
  rawText: string | null;
}

export interface PointSeed {
  validAt: Date;
  latitude: number;
  longitude: number;
  windSpeedKt: number | null;
  pressureMb: number | null;
  category: number | null;
}

/**
 * Seeds a full chain (storm → advisory → forecast points) through the real
 * services so API tests exercise the real read path against Postgres.
 */
export async function seedStorm(
  app: INestApplication,
  storm: StormSeed,
  advisories: Array<{ advisory: AdvisorySeed; points: PointSeed[] }>,
) {
  const stormsService = app.get(StormsService);
  const advisoriesService = app.get(AdvisoriesService);
  const forecastPointsService = app.get(ForecastPointsService);

  const savedStorm = await stormsService.upsertFromIngestion(storm);

  for (const { advisory, points } of advisories) {
    const { advisory: savedAdvisory } =
      await advisoriesService.upsertFromIngestion({
        storm: savedStorm,
        advisoryNumber: advisory.advisoryNumber,
        issuedAt: advisory.issuedAt,
        rawText: advisory.rawText,
      });
    await forecastPointsService.replaceForAdvisory(savedAdvisory, points);
  }

  return savedStorm;
}