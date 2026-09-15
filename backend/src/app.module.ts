import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { envValidationSchema } from './config/env.validation.js';
import { StormsModule } from './domain/weather/storms/storms.module.js';
import { AdvisoriesModule } from './domain/weather/advisories/advisories.module.js';
import { ForecastPointsModule } from './domain/weather/forecast-points/forecast-points.module.js';
import { IngestionModule } from './domain/feeds/ingestion/ingestion.module.js';
import { AuthModule } from './domain/auth/auth.module.js';
import { HealthModule } from './health/health.module.js';

/**
 * Root application module.
 *
 * Wires up environment validation, the Postgres connection (migrations run
 * automatically on boot), the ingestion scheduler and the feature modules:
 * storms, advisories, forecast-points, ingestion and health.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: true,
        logging: ['error', 'warn'],
      }),
    }),
    ScheduleModule.forRoot(),
    StormsModule,
    AdvisoriesModule,
    ForecastPointsModule,
    IngestionModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
