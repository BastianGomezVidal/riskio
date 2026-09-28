import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpCacheService } from './http-cache.service.js';
import { CACHE_SERVICE } from './cache.tokens.js';

/**
 * Provides the cache to the rest of the API.
 *
 * `@Global()` on purpose and unchanged: dashboard, storms and ingestion inject
 * the cache without their own modules importing this one, and dropping the
 * decorator would look like it worked until the first module that did not
 * import it failed to resolve. Kept deliberately.
 *
 * What changed is what sits behind the injection point. The API used to wrap
 * `@nestjs/cache-manager` with a Redis store built from REDIS_URL it held
 * itself; now it holds nothing and talks to the cache service over HTTP. Every
 * consumer keeps calling `getOrSet` and `invalidate` unchanged.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CACHE_SERVICE,
      useClass: HttpCacheService,
    },
  ],
  exports: [CACHE_SERVICE],
})
export class AppCacheModule {}
