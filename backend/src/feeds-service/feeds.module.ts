import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { feedsEnvValidationSchema } from '../config/env.validation.js';
import { NhcProvider } from '../domain/feeds/providers/nhc/nhc.provider.js';
import { IngestionService } from '../domain/feeds/ingestion/ingestion.service.js';
import { IngestionScheduler } from '../domain/feeds/ingestion/scheduler/ingestion.scheduler.js';
import { StormWriter } from '../domain/feeds/ingestion/writers/storm-writer.js';
import { AdvisoryWriter } from '../domain/feeds/ingestion/writers/advisory-writer.js';
import { Storm } from '../domain/weather/storms/entities/storm.entity.js';
import { Advisory } from '../domain/weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../domain/weather/advisories/entities/forecast-point.entity.js';
import { Warning } from '../domain/weather/advisories/entities/warning.entity.js';
import { AppCacheModule } from '../domain/cache/cache.module.js';
import { ObservabilityModule } from '../config/observability.module.js';
import { FeedsController } from './feeds.controller.js';
import { FeedsHealthController } from './feeds-health.controller.js';

/**
 * The feeds service: everything that reads NOAA and writes what it finds.
 *
 * It is the only process that writes storms, advisories, forecast points and
 * warnings. The API keeps the read side of the same tables, because it answers
 * questions about storms, so the database stays shared — a schema per service is
 * explicitly out of scope for this phase.
 *
 * What it does not have: AuthModule, the users module, or any guard. The manual
 * trigger stays in the API, where the api-key and role guards live, and calls
 * this service over the internal network. That is why there is no auth import
 * here, which was the last thing 6.6 needed before the domain could be lifted
 * out.
 *
 * The cache is reached over HTTP like everywhere else, so this process holds no
 * Redis connection and no REDIS_URL. `backend-cache` is the only holder of one.
 */
@Module({
  imports: [
    ObservabilityModule,
    AppCacheModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: feedsEnvValidationSchema,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [Storm, Advisory, ForecastPoint, Warning],
        // Migrations are not run from here. The API owns the schema, and two
        // services racing to migrate is not something to find out about.
        migrationsRun: false,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([Storm, Advisory, ForecastPoint, Warning]),
  ],
  controllers: [FeedsController, FeedsHealthController],
  providers: [
    NhcProvider,
    IngestionService,
    IngestionScheduler,
    StormWriter,
    AdvisoryWriter,
  ],
})
export class FeedsModule {}
