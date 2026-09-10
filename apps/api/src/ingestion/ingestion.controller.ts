import { Controller, Post, Get, HttpCode, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { IngestionService, IngestReport } from './ingestion.service.js';
import { BasinParamDto } from './dto/basin-param.dto.js';

@ApiTags('ingestion')
@Controller('admin/ingest')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  /** Manual trigger for development — runs all basins and returns the report. */
  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run ingestion for all basins' })
  @ApiOkResponse({ description: 'Ingestion report per basin' })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  async runAll(): Promise<IngestReport[]> {
    return this.ingestion.ingestAllBasins();
  }

  /** Same, but only one basin. GET for easy curl testing. */
  @Get('run/:basin')
  @ApiOperation({ summary: 'Run ingestion for a single basin' })
  @ApiOkResponse({ description: 'Ingestion report for the basin' })
  @ApiBadRequestResponse({ description: 'Unknown basin' })
  runOne(@Param() basinParam: BasinParamDto): Promise<IngestReport> {
    return this.ingestion.ingestBasin(basinParam.basin);
  }
}