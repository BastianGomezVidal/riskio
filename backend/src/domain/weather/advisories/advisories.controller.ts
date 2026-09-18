import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { AdvisoryDetailDto, WarningRefDto } from './dto/advisory-detail.dto.js';

@ApiTags('advisories')
@ApiExtraModels(
  Advisory,
  AdvisoryDetailDto,
  WarningRefDto,
  Warning,
  ForecastPoint,
)
@Controller()
export class AdvisoriesController {
  constructor(private readonly advisoriesService: AdvisoriesService) {}

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
      'relations. Warnings are lightweight references (id + type).',
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
}
