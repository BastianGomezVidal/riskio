import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service.js';

/**
 * Liveness and readiness for the cache service.
 *
 * Unlike the storage service, a Redis outage is not fatal: the API degrades to
 * uncached reads. So readiness reports the truth and lets orchestrators see the
 * degradation, rather than pretending everything is fine or taking the API down
 * with it. Nothing `depends_on` this service with a health condition, for
 * exactly that reason.
 */
@Controller('health')
export class CacheHealthController {
  constructor(private readonly cache: RedisCacheService) {}

  @Get()
  async check(): Promise<{ status: string; redis: string }> {
    const reachable = await this.cache.isReachable();
    if (!reachable) {
      throw new ServiceUnavailableException('redis not reachable');
    }
    return { status: 'ok', redis: 'reachable' };
  }
}
