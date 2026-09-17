import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ForecastPointsService } from './forecast-points.service.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';

@ApiTags('forecast-points')
@ApiExtraModels(ForecastPoint)
@Controller()
export class ForecastPointsController {
  constructor(private readonly forecastPointsService: ForecastPointsService) {}

  /**
   * List an advisory's forecast track points chronologically.
   *
   * @param advisoryId advisory UUID.
   */
  @Get('advisories/:advisoryId/forecast-points')
  @ApiOperation({ summary: 'List forecast points for an advisory' })
  @ApiParam({ name: 'advisoryId', description: 'Advisory UUID' })
  @ApiOkResponse({
    description: 'Forecast points for the advisory, ordered by validAt',
    type: ForecastPoint,
    isArray: true,
  })
  findByAdvisory(
    @Param('advisoryId') advisoryId: string,
  ): Promise<ForecastPoint[]> {
    return this.forecastPointsService.findByAdvisory(advisoryId);
  }
}
