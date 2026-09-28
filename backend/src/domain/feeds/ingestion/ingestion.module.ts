import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import { IngestionService } from './ingestion.service.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionScheduler } from './scheduler/ingestion.scheduler.js';
import { StormWriter } from './writers/storm-writer.js';
import { AdvisoryWriter } from './writers/advisory-writer.js';
import { Storm } from '../../weather/storms/entities/storm.entity.js';
import { Advisory } from '../../weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../weather/advisories/entities/forecast-point.entity.js';
import { Warning } from '../../weather/advisories/entities/warning.entity.js';
import { AuthModule } from '../../auth/auth.module.js';

/**
 * Ingestion feature module: NHC polling, manual triggers and scheduling.
 *
 * Wires the {@link NhcProvider} HTTP client, the on-demand
 * {@link IngestionController} endpoints and the cron-driven
 * {@link IngestionScheduler} around the shared {@link IngestionService}.
 *
 * Note what it does *not* import: StormsModule and AdvisoriesModule used to be
 * here so the ingestion could call their write methods. Those writes now belong
 * to {@link StormWriter} and {@link AdvisoryWriter}, which this module declares
 * itself against the entities, so nothing in the feed path depends on a reader
 * service any more. AuthModule stays, and only the controller needs it: the
 * guards on the manual-trigger endpoints are an API concern and belong to the
 * process that serves the API.
 *
 * The writers hold their own repository handles rather than borrowing the
 * readers'. After this module becomes its own service the two run in different
 * processes against the same database, and a shared handle would be the seam
 * that quietly reattaches them.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Storm, Advisory, ForecastPoint, Warning]),
    AuthModule,
  ],
  controllers: [IngestionController],
  providers: [
    NhcProvider,
    IngestionService,
    IngestionScheduler,
    StormWriter,
    AdvisoryWriter,
  ],
  exports: [IngestionService, StormWriter, AdvisoryWriter],
})
export class IngestionModule {}
