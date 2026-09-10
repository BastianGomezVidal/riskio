import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';

@ApiTags('storms')
@Controller('storms')
export class StormsController {
  constructor(private readonly stormsService: StormsService) {}

  @Get()
  @ApiOperation({ summary: 'List all known storms (paginated)' })
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
  @ApiOkResponse({ description: 'Paginated list of storms' })
  findAll(@Query() page: PageQueryDto): Promise<PaginatedResultDto<Storm>> {
    return this.stormsService.findAll(page);
  }

  @Get(':atcfId')
  @ApiOperation({ summary: 'Get a single storm with its advisories' })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
  })
  @ApiOkResponse({ type: Storm })
  findOne(@Param('atcfId') atcfId: string): Promise<Storm> {
    return this.stormsService.findOne(atcfId);
  }
}
