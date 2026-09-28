import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IngestionService } from '../domain/feeds/ingestion/ingestion.service.js';
import type { BasinName } from '../shared/basin/basin.js';

/**
 * The internal contract between the API and the feeds service.
 *
 * Two operations, both "run the ingestion now", and no auth here on purpose:
 * this listens on the `core` network and publishes no port, so the only thing
 * that can reach it is the API. The api-key and role checks stay in the API,
 * where the guards and the users module already are — duplicating them here
 * would mean two places to keep in step and no extra protection, because the
 * endpoint is not reachable from outside the network either way.
 */
@Controller('ingest')
export class FeedsController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post('run')
  runAll(): Promise<unknown> {
    return this.ingestion.ingestAllBasins();
  }

  @Post('run/:basin')
  runOne(@Param('basin') basin: BasinName): Promise<unknown> {
    return this.ingestion.ingestBasin(basin);
  }

  @Get('basins')
  basins(): { basins: BasinName[] } {
    return { basins: ['at', 'ep', 'cp'] };
  }
}
