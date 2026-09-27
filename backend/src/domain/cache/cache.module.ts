import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service.js';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const driver = config.get<string>('CACHE_DRIVER', 'memory');

        if (driver === 'redis') {
          const url = config.getOrThrow<string>('REDIS_URL');
          return {
            stores: [createKeyv(url)],
            ttl: 60_000,
          };
        }

        return { ttl: 60_000 };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {}
