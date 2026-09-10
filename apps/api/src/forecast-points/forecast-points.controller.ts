import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ForecastPointsService } from './forecast-points.service.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';

@ApiTags('forecast-points')
@Controller()
export class ForecastPointsController {
  constructor(private readonly forecastPointsService: ForecastPointsService) {}

  @Get('advisories/:advisoryId/forecast-points')
  @ApiOperation({ summary: 'List forecast points for an advisory (paginated)' })
  @ApiParam({ name: 'advisoryId', description: 'Advisory UUID' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number (1-indexed)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    description: 'Items per page (max 100)',
  })
  @ApiOkResponse({ description: 'Paginated list of forecast points' })
  findByAdvisory(
    @Param('advisoryId') advisoryId: string,
    @Query() page: PageQueryDto,
  ): Promise<PaginatedResultDto<ForecastPoint>> {
    return this.forecastPointsService.findByAdvisory(advisoryId, page);
  }
}
