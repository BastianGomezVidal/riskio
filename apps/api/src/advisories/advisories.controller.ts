import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiQuery,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { ForecastPoint } from '../forecast-points/entities/forecast-point.entity.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';
import { WarningsFeatureCollectionDto } from './dto/warnings-feature-collection.dto.js';

@ApiTags('advisories')
@ApiExtraModels(Advisory, Warning, ForecastPoint, WarningsFeatureCollectionDto)
@Controller()
export class AdvisoriesController {
  constructor(private readonly advisoriesService: AdvisoriesService) {}

  /**
   * List a storm's advisories newest-first.
   *
   * @param atcfId ATCF storm identifier, e.g. `EP142026`.
   * @param page 1-indexed pagination parameters.
   */
  @Get('storms/:atcfId/advisories')
  @ApiOperation({ summary: 'List advisories for a storm (paginated)' })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
  })
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
    description: 'Paginated list of advisories',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResultDto) },
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(Advisory) },
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  findByStorm(
    @Param('atcfId') atcfId: string,
    @Query() page: PageQueryDto,
  ): Promise<PaginatedResultDto<Advisory>> {
    return this.advisoriesService.findByStorm(atcfId, page);
  }

  /**
   * Get one advisory by UUID with its forecast points and warnings.
   *
   * @param id advisory UUID.
   */
  @Get('advisories/:id')
  @ApiOperation({ summary: 'Get a single advisory with its forecast points' })
  @ApiParam({ name: 'id', description: 'Advisory UUID' })
  @ApiOkResponse({
    description: 'Advisory with forecast points',
    type: Advisory,
  })
  @ApiNotFoundResponse({ description: 'No advisory matches the id' })
  findOne(@Param('id') id: string): Promise<Advisory> {
    return this.advisoriesService.findOne(id);
  }

  /**
   * Get an advisory's coastal watch/warning segments as GeoJSON.
   *
   * @param id advisory UUID.
   */
  @Get('advisories/:id/warnings')
  @ApiOperation({
    summary:
      'Get an advisory coastal watch/warnings as a GeoJSON FeatureCollection',
  })
  @ApiParam({ name: 'id', description: 'Advisory UUID' })
  @ApiOkResponse({
    description: 'GeoJSON FeatureCollection of warning lines',
    schema: { $ref: getSchemaPath(WarningsFeatureCollectionDto) },
  })
  @ApiNotFoundResponse({ description: 'No advisory matches the id' })
  findWarnings(@Param('id') id: string) {
    return this.advisoriesService.findWarnings(id);
  }
}
