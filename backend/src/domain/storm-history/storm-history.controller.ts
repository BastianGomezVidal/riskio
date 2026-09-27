import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { HistoryService } from './storm-history.service.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto.js';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';
import { StormHistoryItemDto } from './dto/storm-history-item.dto.js';

@ApiTags('storm')
@ApiExtraModels(Storm, StormHistoryItemDto, PaginatedResultDto)
@Controller('storm-history')
export class StormHistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @ApiOperation({
    summary: 'List historical storms',
    description:
      'Returns paginated storms no longer present in the active NOAA feed, ' +
      'each with its total advisory count. Does not include forecast data; ' +
      'fetch GET /storms/:atcfId for advisories.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
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
              items: { $ref: getSchemaPath(StormHistoryItemDto) },
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  findStormHistory(
    @Query() page: PageQueryDto,
  ): Promise<PaginatedResultDto<StormHistoryItemDto>> {
    return this.historyService.findStormHistory(page);
  }
}
