import { Controller, Get, Param } from '@nestjs/common';
import { ForecastPointsService } from './forecast-points.service.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';

@Controller()
export class ForecastPointsController {
  constructor(private readonly forecastPointsService: ForecastPointsService) {}

  @Get('advisories/:advisoryId/forecast-points')
  findByAdvisory(
    @Param('advisoryId') advisoryId: string,
  ): Promise<ForecastPoint[]> {
    return this.forecastPointsService.findByAdvisory(advisoryId);
  }
}
