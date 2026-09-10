import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';

@ApiTags('advisories')
@Controller()
export class AdvisoriesController {
  constructor(private readonly advisoriesService: AdvisoriesService) {}

  @Get('storms/:atcfId/advisories')
  @ApiOperation({ summary: 'List advisories for a storm (paginated)' })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
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
    example: 20,
    description: 'Items per page (max 100)',
  })
  @ApiOkResponse({ description: 'Paginated list of advisories' })
  findByStorm(
    @Param('atcfId') atcfId: string,
    @Query() page: PageQueryDto,
  ): Promise<PaginatedResultDto<Advisory>> {
    return this.advisoriesService.findByStorm(atcfId, page);
  }

  @Get('advisories/:id')
  @ApiOperation({ summary: 'Get a single advisory with its forecast points' })
  @ApiParam({ name: 'id', description: 'Advisory UUID' })
  @ApiOkResponse({ type: Advisory })
  findOne(@Param('id') id: string): Promise<Advisory> {
    return this.advisoriesService.findOne(id);
  }
}
