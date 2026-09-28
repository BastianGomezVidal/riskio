import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { apiEnvValidationSchema } from './config/env.validation.js';
import { IngestionModule } from './domain/feeds/ingestion/ingestion.module.js';
import { HealthModule } from './health/health.module.js';
import { WeatherProxyModule } from './domain/weather/weather-proxy.module.js';
import { DashboardProxyModule } from './domain/dashboard/dashboard-proxy.module.js';
import { ApiAuthzModule } from './common/authz/api-authz.module.js';
import { AuthProxyMiddleware } from './domain/auth/auth-proxy.middleware.js';
import { ObservabilityModule } from './config/observability.module.js';
import { TraceErrorInterceptor } from './common/interceptors/trace-error.interceptor.js';

/**
 * Root application module.
 *
 * JwtAuthGuard is registered globally from ApiAuthzModule via APP_GUARD,
 * because that is where the User repository is available for injection.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: apiEnvValidationSchema,
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
    HealthModule,
    WeatherProxyModule,
    DashboardProxyModule,
    ApiAuthzModule,
    ObservabilityModule,
  ],
  providers: [
    // Global so every route's span is marked on failure, which is what the
    // tail sampling policy keys off to keep every error trace.
    { provide: APP_INTERCEPTOR, useClass: TraceErrorInterceptor },
  ],
})
export class AppModule implements NestModule {
  /**
   * The gateway half of authentication: `/auth/*` and `/users/*` belong to the
   * auth service now, and the browser only knows one origin.
   *
   * `*splat` rather than `{*splat}`: this is path-to-regexp v8 syntax, where
   * the parameter name comes after the star. The curly-brace form silently
   * matched nothing and every /users/* request answered 404, which looks like
   * the auth service being down rather than a route that was never mounted.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthProxyMiddleware)
      .forRoutes('/auth', '/auth/*splat', '/users', '/users/*splat');
  }


}
