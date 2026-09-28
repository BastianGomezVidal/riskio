import { Module } from '@nestjs/common';
import { NhcProvider } from '../../src/domain/feeds/providers/nhc/nhc.provider.js';
import { IngestionService } from '../../src/domain/feeds/ingestion/ingestion.service.js';
import { StormWriter } from '../../src/domain/feeds/ingestion/writers/storm-writer.js';
import { AdvisoryWriter } from '../../src/domain/feeds/ingestion/writers/advisory-writer.js';
import { Storm } from '../../src/domain/weather/storms/entities/storm.entity.js';
import { Advisory } from '../../src/domain/weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../src/domain/weather/advisories/entities/forecast-point.entity.js';
import { Warning } from '../../src/domain/weather/advisories/entities/warning.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * The feeds service's providers, assembled for a test process.
 *
 * The real FeedsModule cannot be imported here: it opens its own TypeORM
 * connection and arms the cron, and an integration test wants the ingestion
 * logic against the test database with NOAA replaced, not a second process.
 *
 * The FeedsClientService is *overridden* by createTestApp rather than provided
 * here, because IngestionModule already provides it and a second provider for
 * the same token would simply lose. In production that controller calls this
 * service over HTTP, so without the override the controller spec would be
 * testing a client against a hostname that does not exist.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Storm, Advisory, ForecastPoint, Warning])],
  providers: [
    NhcProvider,
    IngestionService,
    StormWriter,
    AdvisoryWriter,
  ],
  exports: [IngestionService, StormWriter, AdvisoryWriter],
})
export class TestFeedsModule {}
