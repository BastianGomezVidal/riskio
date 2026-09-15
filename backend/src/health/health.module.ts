import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';

/**
 * Health feature module: liveness/readiness probe backed by Terminus.
 *
 * Exposes {@link HealthController} at `GET /health`; no shared providers.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
