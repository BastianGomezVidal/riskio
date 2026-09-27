import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
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
import { StormAdvisoryDetailDto } from './dto/storm-advisory-detail.js';

@ApiTags('advisories')
@ApiExtraModels(
  Advisory,
  AdvisoryDetailDto,
  WarningRefDto,
  Warning,
  ForecastPoint,
  StormAdvisoryDetailDto,
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

  @Get('storms/:atcfId/advisories/:n')
  @ApiOperation({
    summary: 'Get one advisory of a storm by number or "latest"',
    description:
      'Returns the storm context plus the full advisory detail ' +
      '(forecastPoints, warnings, track, cone). Use `n=latest` to fetch the ' +
      'newest advisory of the storm.',
  })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP162026',
  })
  @ApiParam({
    name: 'n',
    description: 'Advisory number (positive integer) or the string "latest"',
    example: '5',
  })
  @ApiOkResponse({
    description: 'Storm context and advisory detail',
    type: StormAdvisoryDetailDto,
  })
  @ApiNotFoundResponse({
    description: 'Storm or advisory not found',
  })
  @ApiBadRequestResponse({
    description: 'Advisory number is not a positive integer or "latest"',
  })
  findByStormAndNumber(
    @Param('atcfId') atcfId: string,
    @Param('n') n: string,
  ): Promise<StormAdvisoryDetailDto> {
    let advisoryNumber: number | 'latest';

    if (n === 'latest') {
      advisoryNumber = 'latest';
    } else {
      const parsed = Number(n);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new BadRequestException(
          `Invalid advisory number: "${n}". Use a positive integer or "latest".`,
        );
      }
      advisoryNumber = parsed;
    }

    return this.advisoriesService.findByStormAndNumber(atcfId, advisoryNumber);
  }
}
