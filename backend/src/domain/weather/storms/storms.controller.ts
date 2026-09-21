import { Controller, Get, Param } from '@nestjs/common';
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
import { StormDetailDto } from './dto/storm-detail.dto.js';

@ApiTags('storms')
@ApiExtraModels(StormDetailDto, Advisory)
@Controller('storms')
export class StormsController {
  constructor(private readonly stormsService: StormsService) {}

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
    type: StormDetailDto,
  })
  @ApiNotFoundResponse({ description: 'No storm matches the atcfId' })
  findOne(@Param('atcfId') atcfId: string): Promise<StormDetailDto> {
    return this.stormsService.findOne(atcfId);
  }
}
