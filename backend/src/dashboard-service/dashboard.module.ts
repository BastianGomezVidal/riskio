import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dashboardEnvValidationSchema } from '../config/env.validation.js';
import { DashboardModule } from '../domain/dashboard/dashboard.module.js';
import { WeatherClientModule } from '../domain/dashboard/weather-client.module.js';
import { AppCacheModule } from '../domain/cache/cache.module.js';
import { ObservabilityModule } from '../config/observability.module.js';
import { DashboardHealthController } from './dashboard-health.controller.js';

/**
 * The dashboard service: one aggregated payload of season totals and storms.
 *
 * It has no database connection, and that is the whole shape of it. The summary
 * is a read model assembled from storms and advisories, both owned by the
 * weather service, and it caches the result for 30 seconds through the cache
 * service. So it is a client of two services and an owner of nothing, which is
 * why it is the smallest service in the stack and the safest one to lose.
 *
 * The composition lives in the domain's own DashboardModule, which the API
 * imported until this moved out. Same arrangement as the weather service: the
 * boundary that matters is the network one.
 */
@Module({
  imports: [
    ObservabilityModule,
    AppCacheModule,
    WeatherClientModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: dashboardEnvValidationSchema,
      expandVariables: true,
    }),
    DashboardModule,
  ],
  controllers: [DashboardHealthController],
})
export class DashboardServiceModule {}
