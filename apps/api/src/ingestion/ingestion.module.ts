import { Module } from '@nestjs/common';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import { IngestionService } from './ingestion.service.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionScheduler } from './ingestion.scheduler.js';
import { StormsModule } from '../storms/storms.module.js';
import { AdvisoriesModule } from '../advisories/advisories.module.js';
import { ForecastPointsModule } from '../forecast-points/forecast-points.module.js';

/**
 * Ingestion feature module: NHC polling, manual triggers and scheduling.
 *
 * Wires the {@link NhcProvider} HTTP client, the on-demand
 * {@link IngestionController} endpoints and the cron-driven
 * {@link IngestionScheduler} around the shared {@link IngestionService}.
 */
@Module({
  imports: [StormsModule, AdvisoriesModule, ForecastPointsModule],
  controllers: [IngestionController],
  providers: [NhcProvider, IngestionService, IngestionScheduler],
  exports: [IngestionService],
})
export class IngestionModule {}
