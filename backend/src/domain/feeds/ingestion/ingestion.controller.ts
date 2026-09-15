import { Controller, Post, HttpCode, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiHeader,
  getSchemaPath,
} from '@nestjs/swagger';
import { IngestionService, IngestReport } from './ingestion.service.js';
import { IngestReportDto } from './dto/ingest-report.dto.js';
import { BasinParamDto } from './dto/basin-param.dto.js';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';

/**
 * Development/admin endpoints that trigger NHC ingestion on demand.
 * In production the scheduler covers this automatically. Requests must
 * carry a machine API token in the `x-api-key` header and the owning
 * account must have the `admin` role.
 */
@ApiTags('ingestion')
@ApiExtraModels(IngestReportDto)
@ApiHeader({
  name: 'x-api-key',
  description: 'Machine API token (created via POST /auth/tokens)',
  required: true,
})
@UseGuards(ApiKeyGuard, RolesGuard)
@Roles('admin')
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
