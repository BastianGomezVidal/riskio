import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { cacheEnvValidationSchema } from '../config/env.validation.js';
import { CacheController } from './cache.controller.js';
import { RedisCacheService, type KeyvLike } from './redis-cache.service.js';
import { CACHE_STORE } from './cache.tokens.js';
import { CacheHealthController } from './cache-health.controller.js';
import { ObservabilityModule } from '../config/observability.module.js';

/**
 * The cache service, on its own.
 *
 * This is the only process that holds a Redis connection, so REDIS_URL exists
 * nowhere else. As with the storage service, it does not import AppModule: that
 * would open a database connection and a JWT secret it has no use for.
 *
 * Unlike the storage service, losing this one is survivable rather than fatal —
 * the API degrades to uncached reads by design. So it has no dependency on
 * anything but Redis, and nothing waits for it at boot.
 */
@Module({
  imports: [
    ObservabilityModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: cacheEnvValidationSchema,
      expandVariables: true,
    }),
  ],
  controllers: [CacheController, CacheHealthController],
  providers: [
    {
      provide: CACHE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): KeyvLike => {
        const url = config.getOrThrow<string>('REDIS_URL');
        // The store is created here rather than in the service so the
        // connection string stays in configuration and the service only ever
        // sees the four operations it uses.
        return createKeyv(url) as unknown as KeyvLike;
      },
    },
    RedisCacheService,
  ],
})
export class CacheAppModule {}
