import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  DashboardSummaryDto,
  StormSummaryDto,
} from './dto/dashboard-summary.dto.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { AdvisoriesService } from '../weather/advisories/advisories.service.js';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Storm)
    private readonly stormsRepository: Repository<Storm>,

    private readonly advisoriesService: AdvisoriesService,
  ) {}

  /**
   * Aggregated dashboard read-model: season totals plus every storm with its
   * latest advisory and that advisory's forecast points.
   *
   * Two queries total regardless of storm count:
   *  1. all storms;
   *  2. latest advisory per storm (via AdvisoriesService.findLatestPerStorm).
   */
  async getSummary(): Promise<DashboardSummaryDto> {
    const storms = await this.stormsRepository.find({
      order: { lastSeenAt: 'DESC' },
      take: 100,
    });

    if (storms.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        totals: { events: 0, named: 0, hurricanes: 0, ace: 0 },
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
      return {
        storm,
        latestAdvisory: advisory
          ? {
              id: advisory.id,
              advisoryNumber: advisory.advisoryNumber,
              issuedAt: advisory.issuedAt.toISOString(),
              forecastPoints: advisory.forecastPoints ?? [],
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

function computeTotals(summaries: StormSummaryDto[]): {
  events: number;
  named: number;
  hurricanes: number;
  ace: number;
} {
  let named = 0;
  let hurricanes = 0;
  let ace = 0;

  for (const { storm, latestAdvisory } of summaries) {
    if (storm.name != null) named += 1;

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
  };
}
