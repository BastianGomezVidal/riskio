import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { ForecastPointsService } from './forecast-points.service.js';
import { ForecastPointsController } from './forecast-points.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([ForecastPoint])],
  controllers: [ForecastPointsController],
  providers: [ForecastPointsService],
  exports: [ForecastPointsService],
})
export class ForecastPointsModule {}
