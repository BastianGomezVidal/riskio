import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { ForecastPoint } from '../forecast-points/entities/forecast-point.entity.js';
import { PageQueryDto } from '../../../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../../../common/dto/paginated-result.dto.js';
import { WarningsFeatureCollectionDto } from './dto/warnings-feature-collection.dto.js';

/**
 * HTTP API for querying storm advisories and their associated forecast,
 * track, cone, and coastal watch/warning data.
 *
 * Persistence and domain logic are delegated to {@link AdvisoriesService}.
 * UUID validation is performed at the HTTP boundary using Nest's
 * {@link ParseUUIDPipe}.
 */
@ApiTags('advisories')
@ApiExtraModels(
  Advisory,
  Warning,
  ForecastPoint,
  PaginatedResultDto,
  WarningsFeatureCollectionDto,
)
@Controller()
export class AdvisoriesController {
  constructor(private readonly advisoriesService: AdvisoriesService) {}

  /**
   * List a storm's advisories newest-first.
   *
   * @param atcfId ATCF storm identifier, for example `EP142026`.
   * @param page Pagination parameters.
   * @returns Paginated advisories for the requested storm.
   */
  @Get('storms/:atcfId/advisories')
  @ApiOperation({
    summary: 'List advisories for a storm',
    description:
      'Returns advisories for an ATCF storm ordered from newest to oldest.',
  })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (1-indexed).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Number of items per page (maximum 100).',
  })
  @ApiOkResponse({
    description: 'Paginated list of advisories.',
    schema: {
      allOf: [
        {
          $ref: getSchemaPath(PaginatedResultDto),
        },
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: getSchemaPath(Advisory),
              },
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination parameters.',
  })
  findByStorm(
    @Param('atcfId') atcfId: string,
    @Query() page: PageQueryDto,
  ): Promise<PaginatedResultDto<Advisory>> {
    return this.advisoriesService.findByStorm(atcfId, page);
  }

  /**
   * Get one advisory by UUID with its forecast points and warning relations.
   *
   * @param id Advisory UUID.
   * @returns The requested advisory.
   */
  @Get('advisories/:id')
  @ApiOperation({
    summary: 'Get an advisory by UUID',
    description:
      'Returns a single advisory together with its forecast points and warning relationships.',
  })
  @ApiParam({
    name: 'id',
    description: 'Advisory UUID.',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Advisory with forecast points and warnings.',
    type: Advisory,
  })
  @ApiBadRequestResponse({
    description: 'The advisory id is not a valid UUID.',
  })
  @ApiNotFoundResponse({
    description: 'No advisory matches the supplied id.',
  })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Advisory> {
    return this.advisoriesService.findOne(id);
  }

  /**
   * Get an advisory's coastal watch/warning segments as GeoJSON.
   *
   * An advisory without warning segments returns a valid GeoJSON
   * FeatureCollection with an empty `features` array.
   *
   * @param id Advisory UUID.
   * @returns GeoJSON FeatureCollection containing warning LineStrings.
   */
  @Get('advisories/:id/warnings')
  @ApiOperation({
    summary: 'Get advisory coastal watch/warning segments',
    description:
      'Returns the advisory coastal watch and warning segments as a GeoJSON FeatureCollection.',
  })
  @ApiParam({
    name: 'id',
    description: 'Advisory UUID.',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'GeoJSON FeatureCollection of warning lines.',
    schema: {
      $ref: getSchemaPath(WarningsFeatureCollectionDto),
    },
  })
  @ApiBadRequestResponse({
    description: 'The advisory id is not a valid UUID.',
  })
  @ApiNotFoundResponse({
    description: 'No advisory matches the supplied id.',
  })
  findWarnings(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.advisoriesService.findWarnings(id);
  }
}
