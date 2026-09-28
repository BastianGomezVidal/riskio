import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiAuthzModule } from '../../../common/authz/api-authz.module.js';
import { IngestionController } from './ingestion.controller.js';
import { FeedsClientService } from './feeds-client.service.js';

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
  // The trigger needs ApiKeyGuard, which is not global, so it needs the module
  // that provides it and the verifier behind it. A test overrides the two
  // tokens for the local checkers rather than running an auth service.
  imports: [ConfigModule, ApiAuthzModule],
  controllers: [IngestionController],
  providers: [FeedsClientService],
  exports: [FeedsClientService],
})
export class IngestionModule {}
