import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { AdvisoriesService } from './advisories.service.js';
import { AdvisoriesController } from './advisories.controller.js';

/**
 * Advisories feature module: numbered advisories, their track/cone geometry
 * and coastal watch/warning segments.
 *
 * Registers the {@link Advisory} and {@link Warning} entities, exposes the
 * {@link AdvisoriesController} HTTP surface and shares
 * {@link AdvisoriesService} with the ingestion pipeline.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Advisory, Warning])],
  controllers: [AdvisoriesController],
  providers: [AdvisoriesService],
  exports: [AdvisoriesService],
})
export class AdvisoriesModule {}
