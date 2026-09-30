import { Inject, Injectable } from '@nestjs/common';

import {
  DashboardSummaryDto,
  DashboardTotalsDto,
} from './dto/dashboard-summary.dto.js';
import { StormSummaryDto } from '../weather/storms/dto/storm-summary.dto.js';
import type { StormDto } from '../weather/storms/dto/storm.dto.js';
import type { ForecastPointDto } from '../weather/storms/dto/storm-summary.dto.js';
import { WeatherClientService } from './weather-client.service.js';
import { riskFromCategory } from '../weather/storms/utils/storm-risk.js';
import { CACHE_SERVICE } from '../cache/cache.tokens.js';
import type { CacheService } from '../cache/cache.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly weather: WeatherClientService,

    @Inject(CACHE_SERVICE)
    private readonly cache: CacheService,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    return this.cache.getOrSet('dashboard:summary', 30_000, () =>
      this.computeSummary(),
    );
  }

  private async computeSummary(): Promise<DashboardSummaryDto> {
    // Was a direct repository query; now the weather service answers it. It
    // returns the domain's own StormDto, which already carries advisoryCount
    // and the latest advisory number — so the three fields this used to fill in
    // from a second call now come with the storms, and the extra call below is
    // only needed for the forecast points.
    const storms = (await this.weather.activeStorms()) as StormDto[];

    if (storms.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        totals: {
          events: 0,
          named: 0,
          hurricanes: 0,
          ace: 0,
          pacific: 0,
          atlantic: 0,
        },
        storms: [],
      };
    }

    const latestAdvisories = (await this.weather.latestAdvisoriesPerStorm(
      storms.map((s) => s.atcfId),
    )) as LatestAdvisoryShape[];

    const advisoriesByAtcfId = new Map(
      latestAdvisories.map((a) => [a.storm.atcfId, a]),
    );

    const summaries: StormSummaryDto[] = storms.map((storm) => {
      const advisory = advisoriesByAtcfId.get(storm.atcfId);
      const points = advisory?.forecastPoints ?? [];
      const firstCategory = points[0]?.category ?? null;
      const latestNumber = advisory?.advisoryNumber ?? null;

      return {
        storm: {
          atcfId: storm.atcfId,
          name: storm.name,
          basin: storm.basin,
          /**
           * Dates arrive as ISO strings over HTTP and the DTO promises Date
           * objects, so they are converted here rather than spread through.
           * Spreading looked tidier and quietly broke the type: every date in
           * the response became a string, and only the openapi schema would
           * still have claimed otherwise.
           */
          firstSeenAt: asDate(storm.firstSeenAt),
          lastSeenAt: asDate(storm.lastSeenAt),
          isActive: storm.isActive,
          lastSeenInFeedAt: storm.lastSeenInFeedAt
            ? asDate(storm.lastSeenInFeedAt)
            : null,
          advisoryCount: latestNumber ?? 0,
          latestAdvisoryNumber: latestNumber,
          latestAdvisoryIssuedAt: advisory ? asDate(advisory.issuedAt) : null,
        },
        riskLevel: riskFromCategory(firstCategory),
        latestAdvisory: advisory
          ? {
              id: advisory.id,
              advisoryNumber: advisory.advisoryNumber,
              issuedAt: advisory.issuedAt,
              forecastPoints: points,
            }
          : null,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      totals: computeTotals(summaries),
      storms: summaries,
    };
  }
}

/** Coerce an ISO string or Date into a Date, for the boundary. */
function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The slice of an advisory this summary needs: identity plus its points. */
interface LatestAdvisoryShape {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
  storm: { atcfId: string };
  forecastPoints?: ForecastPointDto[];
}

function computeTotals(summaries: StormSummaryDto[]): DashboardTotalsDto {
  let named = 0;
  let hurricanes = 0;
  let ace = 0;
  let pacific = 0;
  let atlantic = 0;

  for (const { storm, latestAdvisory } of summaries) {
    if (storm.name != null) named += 1;

    if (storm.basin === 'AL') atlantic += 1;
    else if (storm.basin === 'EP' || storm.basin === 'CP') pacific += 1;

    const points = latestAdvisory?.forecastPoints ?? [];

    if (points.some((p) => (p.category ?? 0) >= 1)) hurricanes += 1;

    for (const p of points) {
      if (p.windSpeedKt != null && p.windSpeedKt >= 34) {
        ace += (p.windSpeedKt * p.windSpeedKt) / 10_000;
      }
    }
  }

  return {
    events: summaries.length,
    named,
    hurricanes,
    ace: Math.round(ace * 10) / 10,
    pacific,
    atlantic,
  };
}
