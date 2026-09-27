import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { StormsService } from './storms.service.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';
import { StormDto } from './dto/storm.dto.js';
import { StormListQueryDto } from './dto/storm-list-query.dto.js';

@ApiTags('storms')
@ApiExtraModels(StormDto, Advisory)
@Controller('storms')
export class StormsController {
  constructor(private readonly stormsService: StormsService) {}

  @Get()
  @ApiOperation({
    summary: 'List storms with filters',
    description:
      'Returns lightweight storm rows for the Storms list and Dashboard. ' +
      'Each row includes riskLevel and advisory metrics. Forecast points are ' +
      'NOT included — fetch an advisory for the full track.',
  })
  @ApiOkResponse({
    description: 'Storm list, filtered by the query parameters.',
    type: StormDto,
    isArray: true,
  })
  findAll(@Query() query: StormListQueryDto): Promise<StormDto[]> {
    return this.stormsService.findMany(query);
  }

  @Get(':atcfId')
  @ApiOperation({
    summary: 'Get a single storm with its advisories',
    description:
      'Returns the storm together with its lightweight advisory references. ' +
      'Forecast points, warnings, track and cone are NOT included — fetch ' +
      'GET /advisories/:id for the full advisory.',
  })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
  })
  @ApiOkResponse({
    description: 'Storm with advisory references',
    type: StormDto,
  })
  @ApiNotFoundResponse({ description: 'No storm matches the atcfId' })
  findOne(@Param('atcfId') atcfId: string): Promise<StormDto> {
    return this.stormsService.findOne(atcfId);
  }
}
