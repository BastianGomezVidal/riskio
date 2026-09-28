import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { WeatherClientModule } from './weather-client.module.js';

/**
 * Dashboard read-model module.
 *
 * Reads storms and advisories over HTTP from the weather service. It used to
 * hold a `Repository<Storm>` and the whole AdvisoriesService, which is why the
 * dashboard could not be extracted before weather was: it was the one consumer
 * keeping that domain inside the API.
 */
@Module({
  controllers: [DashboardController],
  imports: [WeatherClientModule],
  providers: [DashboardService],
})
export class DashboardModule {}
