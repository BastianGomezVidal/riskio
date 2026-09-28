import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionController } from './ingestion.controller.js';
import { FeedsClientService } from './feeds-client.service.js';
import { AuthModule } from '../../auth/auth.module.js';

/**
 * The manual ingestion trigger, and nothing else.
 *
 * After the extraction this module no longer ingests anything: the cron, the
 * NOAA provider, the parsers and the database writes all live in the feeds
 * service. What stays here is the admin surface — the api-key and role guards
 * on `POST /admin/ingest/*` — plus the client that forwards to that service.
 *
 * AuthModule is imported for the guards, and that is the only reason it is.
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [IngestionController],
  providers: [FeedsClientService],
  exports: [FeedsClientService],
})
export class IngestionModule {}
