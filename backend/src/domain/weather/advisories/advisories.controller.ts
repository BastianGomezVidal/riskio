import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { ForecastPoint } from '../forecast-points/entities/forecast-point.entity.js';
import { WarningsFeatureCollectionDto } from './dto/warnings-feature-collection.dto.js';
import { AdvisoryDetailDto, WarningRefDto } from './dto/advisory-detail.dto.js';

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
  AdvisoryDetailDto,
  WarningRefDto,
  Warning,
  ForecastPoint,
  WarningsFeatureCollectionDto,
)
@Controller()
export class AdvisoriesController {
  constructor(private readonly advisoriesService: AdvisoriesService) {}

  /**
   * List a storm's advisories newest-first.
   *
   * @param atcfId ATCF storm identifier, for example `EP142026`.
   * @returns advisories for the requested storm, newest first.
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
  @ApiOkResponse({
    description: 'Advisories for the storm, newest first.',
    type: Advisory,
    isArray: true,
  })
  findByStorm(@Param('atcfId') atcfId: string): Promise<Advisory[]> {
    return this.advisoriesService.findByStorm(atcfId);
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
      'Returns a single advisory together with its forecastPoints and warning ' +
      'relations. Warnings are lightweight references (id + type); use ' +
      'GET /advisories/:id/warnings for their GeoJSON geometry.',
  })
  @ApiParam({
    name: 'id',
    description: 'Advisory UUID.',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Advisory with forecast points and warnings.',
    type: AdvisoryDetailDto,
  })
  @ApiBadRequestResponse({
    description: 'The advisory id is not a valid UUID.',
  })
  @ApiNotFoundResponse({ description: 'No advisory matches the supplied id.' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdvisoryDetailDto> {
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
    schema: { $ref: getSchemaPath(WarningsFeatureCollectionDto) },
  })
  @ApiBadRequestResponse({
    description: 'The advisory id is not a valid UUID.',
  })
  @ApiNotFoundResponse({ description: 'No advisory matches the supplied id.' })
  findWarnings(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.advisoriesService.findWarnings(id);
  }
}
