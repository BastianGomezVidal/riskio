import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiQuery,
  ApiBadRequestResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ForecastPointsService } from './forecast-points.service.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';

@ApiTags('forecast-points')
@ApiExtraModels(ForecastPoint, PaginatedResultDto)
@Controller()
export class ForecastPointsController {
  constructor(private readonly forecastPointsService: ForecastPointsService) {}

  /**
   * List an advisory's forecast track points chronologically.
   *
   * @param advisoryId advisory UUID.
   * @param page 1-indexed pagination parameters.
   */
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
  @ApiOkResponse({
    description: 'Paginated list of forecast points',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResultDto) },
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(ForecastPoint) },
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  findByAdvisory(
    @Param('advisoryId') advisoryId: string,
    @Query() page: PageQueryDto,
  ): Promise<PaginatedResultDto<ForecastPoint>> {
    return this.forecastPointsService.findByAdvisory(advisoryId, page);
  }
}
