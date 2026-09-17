import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { AdvisoriesModule } from '../weather/advisories/advisories.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

/**
 * Dashboard read-model module.
 *
 * Reads storms directly and delegates "latest advisory per storm" to
 * AdvisoriesService so the query lives in one place.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Storm]), AdvisoriesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
