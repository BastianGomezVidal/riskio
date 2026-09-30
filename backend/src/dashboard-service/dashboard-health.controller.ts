import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Public } from '../domain/auth/decorators/public.decorator.js';
import { CACHE_SERVICE } from '../domain/cache/cache.tokens.js';
import type { CacheService } from '../domain/cache/cache.service.js';

/**
 * Liveness for the dashboard.
 *
 * There is no database to ping — this service owns none — so the check is that
 * it can still be asked. Readiness deliberately does not test weather: a weather
 * outage makes the summary unavailable, and reporting this service unhealthy
 * would take it out of rotation over something it does not own.
 */
@Controller('health')
@Public()
export class DashboardHealthController {
  constructor(@Inject(CACHE_SERVICE) private readonly cache: CacheService) {}

  @Get()
  async check(): Promise<{ status: string; cache: string }> {
    // A write and a read, not a read of a key that was never written.
    //
    // Reading `__health__` and treating undefined as "unreachable" reported
    // unreachable on a cache that was up and reachable: nothing ever sets that
    // key, so a miss and an outage were indistinguishable, and the check could
    // only ever answer one of the two. The round trip is also the honest
    // question. This client fails open, so a dead cache resolves to undefined
    // rather than throwing, which is the intended degradation for a page read
    // and useless as a health signal.
    const probe = `__health__:${process.pid}`;
    try {
      await this.cache.set(probe, 'ok', 5_000);
      const value = await this.cache.get<string>(probe);
      await this.cache.del(probe);
      return {
        status: 'ok',
        cache: value === 'ok' ? 'reachable' : 'unreachable',
      };
    } catch {
      // The client is contracted not to throw, so reaching here means the
      // contract changed. Report the outage rather than a 500 that says nothing
      // about which dependency is at fault.
      return { status: 'ok', cache: 'unreachable' };
    }
  }
}
