import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { StormsModule } from '../../src/domain/weather/storms/storms.module.js';
import { AdvisoriesModule } from '../../src/domain/weather/advisories/advisories.module.js';
import { IngestionModule } from '../../src/domain/feeds/ingestion/ingestion.module.js';
import { AuthModule } from '../../src/domain/auth/auth.module.js';
import { DashboardModule } from '../../src/domain/dashboard/dashboard.module.js';
import { HistoryModule } from '../../src/domain/history/history.module.js';
import { HealthModule } from '../../src/health/health.module.js';
import { InitialSchema1789065155402 } from '../../src/database/migrations/1789065155402-InitialSchema.js';
import { AddStormGeometry1888240000000 } from '../../src/database/migrations/1888240000000-AddStormGeometry.js';
import { AddAuthTables1890000000000 } from '../../src/database/migrations/1890000000000-AddAuthTables.js';
import { AddStormActivityFlags1891000000000 } from '../../src/database/migrations/1891000000000-AddStormActivityFlags.js';
import { TEST_DATABASE_URL } from '../setup-integration.js';
import { StormsService } from '../../src/domain/weather/storms/storms.service.js';
import { AdvisoriesService } from '../../src/domain/weather/advisories/advisories.service.js';

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
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            JWT_SECRET: 'test-secret-at-least-16-chars',
          }),
        ],
      }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: TEST_DATABASE_URL,
        autoLoadEntities: true,
        synchronize: false,
        migrations: [
          InitialSchema1789065155402,
          AddStormGeometry1888240000000,
          AddAuthTables1890000000000,
          AddStormActivityFlags1891000000000,
        ],
        migrationsRun: true,
        logging: false,
      }),
      ScheduleModule.forRoot(),
      StormsModule,
      AdvisoriesModule,
      IngestionModule,
      AuthModule,
      DashboardModule,
      HistoryModule,
      HealthModule,
    ],
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
  track?: { type: 'LineString'; coordinates: number[][] } | null;
  cone?: { type: 'Polygon'; coordinates: number[][][] } | null;
  warnings?: Array<{
    warningType: string;
    geometry: { type: 'LineString'; coordinates: number[][] };
  }>;
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
 *
 * Forecast points are persisted via AdvisoriesService now that they are part
 * of the advisories aggregate.
 */
export async function seedStorm(
  app: INestApplication,
  storm: StormSeed,
  advisories: Array<{ advisory: AdvisorySeed; points: PointSeed[] }>,
) {
  const stormsService = app.get(StormsService);
  const advisoriesService = app.get(AdvisoriesService);

  const savedStorm = await stormsService.upsertFromIngestion(storm);

  for (const { advisory, points } of advisories) {
    const { advisory: savedAdvisory } =
      await advisoriesService.upsertFromIngestion({
        storm: savedStorm,
        advisoryNumber: advisory.advisoryNumber,
        issuedAt: advisory.issuedAt,
        rawText: advisory.rawText,
      });

    await advisoriesService.replaceForecastPoints(savedAdvisory, points);

    if (advisory.track !== undefined || advisory.cone !== undefined) {
      await advisoriesService.setTrackCone(
        savedAdvisory.id,
        (advisory.track as never) ?? null,
        (advisory.cone as never) ?? null,
      );
    }

    if (advisory.warnings && advisory.warnings.length > 0) {
      await advisoriesService.replaceWarnings(
        savedAdvisory,
        advisory.warnings as never[],
      );
    }
  }

  return savedStorm;
}
