import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LineString, Polygon } from 'geojson';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';
import { AdvisoryDetailDto } from './dto/advisory-detail.dto.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import type { ForecastPointDto } from '../../../common/contracts/forecast-point.dto.js';
import type { WarningSegmentDto } from '../../../common/contracts/warning-segment.dto.js';
import { categoryFromWindKt } from '../storms/storm-category.js';
import { StormDto } from '../storms/dto/storm.dto.js';
import { StormAdvisoryDetailDto } from './dto/storm-advisory-detail.js';

/**
 * Service responsible for querying and updating storm advisories.
 *
 * This service owns advisory-related persistence operations, including:
 * - advisory list queries;
 * - latest-advisory-per-storm lookups;
 * - advisory detail retrieval;
 * - forecast track and cone geometry updates;
 * - coastal watch/warning replacement;
 * - GeoJSON warning responses;
 * - idempotent advisory insertion during ingestion.
 */
@Injectable()
export class AdvisoriesService {
  constructor(
    @InjectRepository(Advisory)
    private readonly advisoriesRepository: Repository<Advisory>,

    @InjectRepository(Warning)
    private readonly warningsRepository: Repository<Warning>,

    @InjectRepository(ForecastPoint)
    private readonly forecastPointsRepository: Repository<ForecastPoint>,
  ) {}

  /**
   * List the latest advisory for each of the supplied storms.
   *
   * A single batched query fetches every advisory (with storm and forecast
   * points) for the given ATCF ids, ordered so that the newest advisory for
   * each storm appears first. The first row seen per storm is retained.
   *
   * @param atcfIds ATCF identifiers of the storms to look up.
   * @returns One advisory per storm that has at least one advisory.
   */
  async findLatestPerStorm(atcfIds: string[]): Promise<Advisory[]> {
    if (atcfIds.length === 0) {
      return [];
    }

    const rows = await this.advisoriesRepository
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.storm', 'storm')
      .leftJoinAndSelect('a.forecastPoints', 'point')
      .where('storm.atcfId IN (:...atcfIds)', { atcfIds })
      .orderBy('storm.atcfId', 'ASC')
      .addOrderBy('a.advisoryNumber', 'DESC')
      .addOrderBy('point.validAt', 'ASC')
      .getMany();

    const latestByStorm = new Map<string, Advisory>();

    for (const advisory of rows) {
      if (!latestByStorm.has(advisory.storm.atcfId)) {
        latestByStorm.set(advisory.storm.atcfId, advisory);
      }
    }

    return [...latestByStorm.values()];
  }

  /**
   * Fetch one advisory by UUID with its forecast points and warnings.
   *
   * @param id Advisory UUID.
   * @returns The advisory including forecast points and warning relations.
   * @throws NotFoundException when no advisory matches the supplied UUID.
   */
  async findOne(id: string): Promise<AdvisoryDetailDto> {
    const advisory = await this.advisoriesRepository.findOne({
      where: { id },
      relations: {
        forecastPoints: true,
        warnings: true,
      },
    });

    if (!advisory) {
      throw new NotFoundException(`Advisory ${id} not found`);
    }

    return advisory as AdvisoryDetailDto;
  }





  /**
   * Fetch one advisory by storm ATCF id and advisory number, together with
   * the storm context needed to render the advisory view.
   *
   * `advisoryNumber` accepts the string 'latest' to resolve the newest
   * advisory for the storm.
   *
   * Returns the storm aggregate (without advisories[] and without
   * riskLevel) plus the full advisory detail (forecast points, warnings,
   * track, cone).
   *
   * @throws NotFoundException when the storm or advisory does not exist.
   */
  async findByStormAndNumber(
    atcfId: string,
    advisoryNumber: number | 'latest',
  ): Promise<StormAdvisoryDetailDto> {
    // 1. Resolve the storm row.
    const storm = await this.advisoriesRepository.manager
      .getRepository(Storm)
      .findOne({ where: { atcfId } });

    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }

    // 2. Resolve 'latest' to the highest advisory number.
    let resolvedNumber: number;
    if (advisoryNumber === 'latest') {
      const latest = await this.advisoriesRepository
        .createQueryBuilder('a')
        .select('MAX(a.advisoryNumber)', 'maxNumber')
        .where('a.storm_atcf_id = :atcfId', { atcfId })
        .getRawOne<{ maxNumber: string | null }>();

      if (!latest?.maxNumber) {
        throw new NotFoundException(`Storm ${atcfId} has no advisories yet`);
      }
      resolvedNumber = Number(latest.maxNumber);
    } else {
      resolvedNumber = advisoryNumber;
    }

    // 3. Load the advisory with its relations.
    const advisory = await this.advisoriesRepository.findOne({
      where: {
        storm: { atcfId },
        advisoryNumber: resolvedNumber,
      },
      relations: {
        forecastPoints: true,
        warnings: true,
      },
    });

    if (!advisory) {
      throw new NotFoundException(
        `Advisory #${resolvedNumber} not found for storm ${atcfId}`,
      );
    }

    // 4. Aggregate counters + latest advisory issuedAt for the storm.
    const metrics = await this.advisoriesRepository
      .createQueryBuilder('a')
      .select('COUNT(a.id)', 'advisoryCount')
      .addSelect('MAX(a.advisoryNumber)', 'latestAdvisoryNumber')
      .addSelect(
        `(
      SELECT a2."issuedAt"
      FROM advisories a2
      WHERE a2."storm_atcf_id" = :atcfId
      ORDER BY a2."advisoryNumber" DESC
      LIMIT 1
    )`,
        'latestAdvisoryIssuedAt',
      )
      .where('a.storm = :atcfId', { atcfId })
      .getRawOne<{
        advisoryCount: string;
        latestAdvisoryNumber: string | null;
        latestAdvisoryIssuedAt: Date | null;
      }>();

    // 5. Assemble the response.
    const stormDto: StormDto = {
      atcfId: storm.atcfId,
      name: storm.name,
      basin: storm.basin,
      firstSeenAt: storm.firstSeenAt,
      lastSeenAt: storm.lastSeenAt,
      isActive: storm.isActive,
      lastSeenInFeedAt: storm.lastSeenInFeedAt,
      advisoryCount: metrics ? Number(metrics.advisoryCount) : 0,
      latestAdvisoryNumber:
        metrics?.latestAdvisoryNumber != null
          ? Number(metrics.latestAdvisoryNumber)
          : null,
      latestAdvisoryIssuedAt: metrics?.latestAdvisoryIssuedAt ?? null,
    };

    return {
      storm: stormDto,
      advisory: advisory as unknown as AdvisoryDetailDto,
    };
  }




}
