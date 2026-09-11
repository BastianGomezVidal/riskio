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
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';

@ApiTags('storms')
@ApiExtraModels(Storm, Advisory, PaginatedResultDto)
@Controller('storms')
export class StormsController {
  constructor(private readonly stormsService: StormsService) {}

  /**
   * List all known storms, most recently seen first.
   *
   * @param page 1-indexed pagination parameters.
   */
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
  @ApiOkResponse({
    description: 'Paginated list of storms',
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
  findAll(@Query() page: PageQueryDto): Promise<PaginatedResultDto<Storm>> {
    return this.stormsService.findAll(page);
  }

  /**
   * Get a single storm with its advisories.
   *
   * @param atcfId ATCF storm identifier, e.g. `EP142026`.
   */
  @Get(':atcfId')
  @ApiOperation({ summary: 'Get a single storm with its advisories' })
  @ApiParam({
    name: 'atcfId',
    description: 'ATCF storm identifier',
    example: 'EP142026',
  })
  @ApiOkResponse({ description: 'Storm with advisories', type: Storm })
  @ApiNotFoundResponse({ description: 'No storm matches the atcfId' })
  findOne(@Param('atcfId') atcfId: string): Promise<Storm> {
    return this.stormsService.findOne(atcfId);
  }
}
