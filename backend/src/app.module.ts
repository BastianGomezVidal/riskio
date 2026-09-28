import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { envValidationSchema } from './config/env.validation.js';
import { IngestionModule } from './domain/feeds/ingestion/ingestion.module.js';
import { AuthModule } from './domain/auth/auth.module.js';
import { UsersModule } from './domain/users/users.module.js';
import { HealthModule } from './health/health.module.js';
import { DashboardModule } from './domain/dashboard/dashboard.module.js';
import { WeatherProxyModule } from './domain/weather/weather-proxy.module.js';
import { AppCacheModule } from './domain/cache/cache.module.js';
import { ObservabilityModule } from './config/observability.module.js';
import { TraceErrorInterceptor } from './common/interceptors/trace-error.interceptor.js';

/**
 * Root application module.
 *
 * JwtAuthGuard is registered globally from AuthModule via APP_GUARD,
 * because that is where the User repository is available for injection.
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
    // Provides the manual-trigger endpoints and the client that forwards to
    // the feeds service. The ingestion itself is not here any more: the cron,
    // the NOAA client, the parsers and every write live in backend-feeds.
    IngestionModule,
    AuthModule,
    UsersModule,
    HealthModule,
    DashboardModule,
    WeatherProxyModule,
    AppCacheModule,
    ObservabilityModule,
  ],
  providers: [
    // Global so every route's span is marked on failure, which is what the
    // tail sampling policy keys off to keep every error trace.
    { provide: APP_INTERCEPTOR, useClass: TraceErrorInterceptor },
  ],
})
export class AppModule {}
