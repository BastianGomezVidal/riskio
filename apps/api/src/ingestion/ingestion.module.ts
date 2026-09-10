import { Module } from '@nestjs/common';
import { NhcProvider } from './nhc.provider.js';
import { IngestionService } from './ingestion.service.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionScheduler } from './ingestion.scheduler.js';
import { StormsModule } from '../storms/storms.module.js';
import { AdvisoriesModule } from '../advisories/advisories.module.js';
import { ForecastPointsModule } from '../forecast-points/forecast-points.module.js';

@Module({
  imports: [StormsModule, AdvisoriesModule, ForecastPointsModule],
  controllers: [IngestionController],
  providers: [NhcProvider, IngestionService, IngestionScheduler],
  exports: [IngestionService],
})
export class IngestionModule {}
