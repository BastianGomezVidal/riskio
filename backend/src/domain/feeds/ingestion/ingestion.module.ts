import { Module } from '@nestjs/common';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import { IngestionService } from './ingestion.service.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionScheduler } from './scheduler/ingestion.scheduler.js';
import { StormsModule } from '../../weather/storms/storms.module.js';
import { AdvisoriesModule } from '../../weather/advisories/advisories.module.js';
import { AuthModule } from '../../auth/auth.module.js';

/**
 * Ingestion feature module: NHC polling, manual triggers and scheduling.
 *
 * Wires the {@link NhcProvider} HTTP client, the on-demand
 * {@link IngestionController} endpoints and the cron-driven
 * {@link IngestionScheduler} around the shared {@link IngestionService}.
 */
@Module({
  imports: [StormsModule, AdvisoriesModule, AuthModule],
  controllers: [IngestionController],
  providers: [NhcProvider, IngestionService, IngestionScheduler],
  exports: [IngestionService],
})
export class IngestionModule {}
