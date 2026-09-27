import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  DashboardSummaryDto,
  DashboardTotalsDto,
} from './dto/dashboard-summary.dto.js';
import { StormSummaryDto } from '../weather/storms/dto/storm-summary.dto.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { AdvisoriesService } from '../weather/advisories/advisories.service.js';
import { riskFromCategory } from '../weather/storms/utils/storm-risk.js';
import { CacheService } from '../cache/cache.service.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Storm)
    private readonly stormsRepository: Repository<Storm>,

    private readonly advisoriesService: AdvisoriesService,

    private readonly cache: CacheService,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    return this.cache.getOrSet('dashboard:summary', 30_000, () =>
      this.computeSummary(),
    );
  }

  private async computeSummary(): Promise<DashboardSummaryDto> {
    const storms = await this.stormsRepository.find({
      where: { isActive: true },
      order: { lastSeenInFeedAt: 'DESC' },
      take: 100,
    });

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

    const latestAdvisories = await this.advisoriesService.findLatestPerStorm(
      storms.map((s) => s.atcfId),
    );

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
          firstSeenAt: storm.firstSeenAt,
          lastSeenAt: storm.lastSeenAt,
          isActive: storm.isActive,
          lastSeenInFeedAt: storm.lastSeenInFeedAt,
          advisoryCount: latestNumber ?? 0,
          latestAdvisoryNumber: latestNumber,
          latestAdvisoryIssuedAt: advisory?.issuedAt ?? null,
        },
        riskLevel: riskFromCategory(firstCategory),
        latestAdvisory: advisory
          ? {
              id: advisory.id,
              advisoryNumber: advisory.advisoryNumber,
              issuedAt: advisory.issuedAt.toISOString(),
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
