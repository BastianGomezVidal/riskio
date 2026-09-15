import { Controller, Post, HttpCode, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { IngestionService, IngestReport } from './ingestion.service.js';
import { IngestReportDto } from './dto/ingest-report.dto.js';
import { BasinParamDto } from './dto/basin-param.dto.js';

/**
 * Development/admin endpoints that trigger NHC ingestion on demand.
 * In production the scheduler covers this automatically.
 */
@ApiTags('ingestion')
@ApiExtraModels(IngestReportDto)
@Controller('admin/ingest')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  // Ingest all basins on demand; returns one report per basin.
  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run ingestion for all basins' })
  @ApiOkResponse({
    description: 'Ingestion report per basin',
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(IngestReportDto) },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  async runAll(): Promise<IngestReport[]> {
    return this.ingestion.ingestAllBasins();
  }

  /**
   * Ingest a single basin; useful for quick manual checks of one region.
   *
   * @param basinParam validated basin route parameter (`at`, `ep` or `cp`).
   */
  @Post('run/:basin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run ingestion for a single basin' })
  @ApiOkResponse({
    description: 'Ingestion report for the basin',
    schema: { $ref: getSchemaPath(IngestReportDto) },
  })
  @ApiBadRequestResponse({ description: 'Unknown basin' })
  runOne(@Param() basinParam: BasinParamDto): Promise<IngestReport> {
    return this.ingestion.ingestBasin(basinParam.basin);
  }
}
