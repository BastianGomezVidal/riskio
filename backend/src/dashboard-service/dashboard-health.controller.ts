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
    // Fail open is this cache client's contract, so a dead cache answers
    // "unreachable" here instead of throwing, which is the honest report: the
    // dashboard still renders, just slower.
    const value = await this.cache.get<string>('__health__');
    return {
      status: 'ok',
      cache: value === undefined ? 'unreachable' : 'reachable',
    };
  }
}
