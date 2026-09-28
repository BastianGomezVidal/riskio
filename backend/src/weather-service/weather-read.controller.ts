import { Controller, Get, Inject, Query } from '@nestjs/common';
import { StormsService } from '../domain/weather/storms/storms.service.js';
import { AdvisoriesService } from '../domain/weather/advisories/advisories.service.js';
import { StormTab } from '../domain/weather/storms/utils/storm-enums.js';
import type { StormListQueryDto } from '../domain/weather/storms/dto/storm-list-query.dto.js';
import { CACHE_SERVICE } from '../domain/cache/cache.tokens.js';
import type { CacheService } from '../domain/cache/cache.service.js';

/**
 * Internal reads, for the other services in the system.
 *
 * Not a generic query API and not a dashboard-shaped endpoint: these are the
 * two questions the weather domain is asked by the rest of the platform, and
 * both already existed as methods. What is new is that they are reachable over
 * the network.
 *
 * The list comes from a query string rather than a POST body because it is
 * genuinely a GET with no side effects, and because a hundred atcfIds in a URL
 * is awkward but not wrong. If it ever grows past that, the honest fix is a POST
 * with an explicit "this is a read" name, not a 10 KB URL.
 */
@Controller('internal/weather')
export class WeatherReadController {
  constructor(
    private readonly storms: StormsService,
    private readonly advisories: AdvisoriesService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  /**
   * Active storms, newest feed sighting first, capped by the caller.
   *
   * Goes through {@link StormsService.findMany} rather than reaching for the
   * repository, so the cache key, the ordering and the tab semantics stay in
   * one place. The dashboard used to run this query itself with `take: 100`;
   * asking the domain for it is why the response is identical across the
   * extraction instead of merely similar.
   *
   * No take parameter: StormListQueryDto has no such field, so passing one
   * would have been a cast that TypeScript accepted and the service ignored. The
   * 100-storm cap the dashboard applied stays a property of that caller rather
   * than becoming a parameter nothing enforces.
   */
  @Get('active-storms')
  activeStorms(): Promise<unknown> {
    return this.storms.findMany({ tab: StormTab.Active });
  }

  /**
   * Latest advisory per storm, with forecast points, for a batch of ids.
   *
   * Failing open on a dead cache, exactly as everywhere else: the dashboard has
   * to render whether or not the cache is up.
   */
  @Get('latest-per-storm')
  latestPerStorm(@Query('atcfIds') atcfIds?: string): Promise<unknown> {
    return this.cache.getOrSet(
      `weather:latest:${atcfIds ?? ''}`,
      30_000,
      () => this.advisories.findLatestPerStorm((atcfIds ?? '').split(',').filter(Boolean)),
    );
  }
}
