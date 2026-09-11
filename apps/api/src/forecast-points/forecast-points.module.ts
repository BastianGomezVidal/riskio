import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { ForecastPointsService } from './forecast-points.service.js';
import { ForecastPointsController } from './forecast-points.controller.js';

/**
 * Forecast-points feature module: time-indexed track points of an advisory.
 *
 * Registers the {@link ForecastPoint} entity, exposes the
 * {@link ForecastPointsController} HTTP surface and shares
 * {@link ForecastPointsService} with the ingestion pipeline.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ForecastPoint])],
  controllers: [ForecastPointsController],
  providers: [ForecastPointsService],
  exports: [ForecastPointsService],
})
export class ForecastPointsModule {}
