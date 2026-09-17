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
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';
import { PageQueryDto } from '../../../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../../../common/dto/paginated-result.dto.js';
import { StormDetailDto } from './dto/storm-detail.dto.js';

@ApiTags('storms')
@ApiExtraModels(Storm, StormDetailDto, Advisory, PaginatedResultDto)
@Controller('storms')
export class StormsController {
  constructor(private readonly stormsService: StormsService) {}

  /**
   * List currently active storms — those NOAA is tracking in its most
   * recent feed for every basin.
   *
   * Ordered by the feed pass that last saw each storm, newest-first.
   * No pagination: the active set is bounded by what NOAA reports.
   */
  @Get()
  @ApiOperation({
    summary: 'List active storms',
    description:
      'Returns storms currently present in the latest NOAA feed. ' +
      'Ordered by the most recent feed pass that saw them.',
  })
  @ApiOkResponse({
    description: 'Active storms, newest feed appearance first',
    type: Storm,
    isArray: true,
  })
  findActive(): Promise<Storm[]> {
    return this.stormsService.findActive();
  }

  /**
   * Paginated list of historical (non-active) storms.
   *
   * NOTE: this route must be declared before `:atcfId`, or Nest will
   * match "history" as an ATCF identifier.
   */
  @Get('history')
  @ApiOperation({
    summary: 'List historical storms',
    description:
      'Returns paginated storms that are no longer present in the active ' +
      'NOAA feed, ordered by the feed pass that last saw them.',
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
    example: 50,
    description: 'Items per page (max 100)',
  })
  @ApiOkResponse({
    description: 'Paginated list of historical storms',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResultDto) },
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(Storm) },
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  findHistory(@Query() page: PageQueryDto): Promise<PaginatedResultDto<Storm>> {
    return this.stormsService.findHistory(page);
  }

  /**
   * Get a single storm with its advisories.
   *
   * The advisories returned here are the plain rows; their forecastPoints
   * and warnings relations are NOT loaded. Use `GET /advisories/:id` for
   * the expanded advisory.
   */
  @Get(':atcfId')
  @ApiOperation({
    summary: 'Get a single storm with its advisories',
    description:
      'Returns the storm together with its advisories. The advisories are ' +
      'the plain rows; forecastPoints and warnings are NOT included here — ' +
      'fetch GET /advisories/:id for the expanded advisory.',
  })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
  })
  @ApiOkResponse({
    description: 'Storm with advisories',
    type: StormDetailDto,
  })
  @ApiNotFoundResponse({ description: 'No storm matches the atcfId' })
  findOne(@Param('atcfId') atcfId: string): Promise<StormDetailDto> {
    return this.stormsService.findOne(atcfId);
  }
}
