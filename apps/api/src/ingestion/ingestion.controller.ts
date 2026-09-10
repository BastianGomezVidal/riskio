import { Controller, Post, Get, HttpCode } from '@nestjs/common';
import { IngestionService, IngestReport } from './ingestion.service.js';

@Controller('admin/ingest')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  /** Manual trigger for development — runs all basins and returns the report. */
  @Post('run')
  @HttpCode(200)
  async runAll(): Promise<IngestReport[]> {
    return this.ingestion.ingestAllBasins();
  }

  /** Same, but only one basin. GET for easy curl testing. */
  @Get('run/at')
  runAt(): Promise<IngestReport> {
    return this.ingestion.ingestBasin('at');
  }

  @Get('run/ep')
  runEp(): Promise<IngestReport> {
    return this.ingestion.ingestBasin('ep');
  }

  @Get('run/cp')
  runCp(): Promise<IngestReport> {
    return this.ingestion.ingestBasin('cp');
  }
}
