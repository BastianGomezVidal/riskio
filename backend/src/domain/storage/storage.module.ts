import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpStorageService } from './http-storage.service.js';
import { STORAGE_SERVICE } from './storage.tokens.js';

/**
 * Provides storage to the rest of the API.
 *
 * What changed here is the provider and nothing else: the token is the same, so
 * `users.service.ts` still injects `STORAGE_SERVICE` and still sees the same
 * three methods. What it now gets behind that token is an HTTP client instead
 * of the S3 SDK, which is the whole point of the extraction and also the reason
 * it did not need a single change in `users`.
 *
 * The S3 implementation and the credentials it needs moved to the storage
 * service, where they belong.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: HttpStorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
