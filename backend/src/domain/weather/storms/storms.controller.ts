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
import { Storm } from './entities/storm.entity.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';
import { StormDetailDto } from './dto/storm-detail.dto.js';

@ApiTags('storms')
@ApiExtraModels(Storm, StormDetailDto, Advisory)
@Controller('storms')
export class StormsController {
  constructor(private readonly stormsService: StormsService) {}

  /**
   * List all known storms, most recently seen first.
   */
  @Get()
  @ApiOperation({ summary: 'List all known storms' })
  @ApiOkResponse({
    description: 'List of storms',
    type: Storm,
    isArray: true,
  })
  findAll(): Promise<Storm[]> {
    return this.stormsService.findAll();
  }

  /**
   * Get a single storm with its advisories.
   *
   * The advisories returned here are the plain rows; their forecastPoints
   * and warnings relations are NOT loaded. Use GET /advisories/:id for the
   * expanded advisory.
   *
   * @param atcfId ATCF storm identifier, e.g. `EP142026`.
   */
  @Get(':atcfId')
  @ApiOperation({
    summary: 'Get a single storm with its advisories',
    description:
      'Returns the storm together with its advisories. The advisories are the ' +
      'plain rows; forecastPoints and warnings are NOT included here — fetch ' +
      'GET /advisories/:id for the expanded advisory.',
  })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
  })
  @ApiOkResponse({ description: 'Storm with advisories', type: StormDetailDto })
  @ApiNotFoundResponse({ description: 'No storm matches the atcfId' })
  findOne(@Param('atcfId') atcfId: string): Promise<StormDetailDto> {
    return this.stormsService.findOne(atcfId);
  }
}
