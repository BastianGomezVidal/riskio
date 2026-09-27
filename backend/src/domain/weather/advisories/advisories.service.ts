import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LineString, Polygon } from 'geojson';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';
import { AdvisoryDetailDto } from './dto/advisory-detail.dto.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import type { ForecastPointDto } from '../../feeds/parser/nhc-parser.js';
import { categoryFromWindKt } from '../storms/storm-category.js';
import { StormDto } from '../storms/dto/storm.dto.js';
import { StormAdvisoryDetailDto } from './dto/storm-advisory-detail.js';

/**
 * A coastal watch/warning geometry received from the ingestion layer.
 *
 * The geometry is represented as a GeoJSON LineString and is persisted
 * against the owning advisory.
 */
export interface WarningSegmentDto {
  /** Human-readable warning type, for example `Hurricane Watch`. */
  warningType: string;

  /** Coastal segment geometry. */
  geometry: LineString;
}

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
   * Replace an advisory's forecast track and cone geometry.
   *
   * Passing `null` explicitly clears the corresponding geometry. This is
   * useful when a product is absent or was previously available but is no
   * longer published.
   *
   * @param id Advisory UUID.
   * @param track Forecast track LineString, or `null` to clear it.
   * @param cone Cone-of-uncertainty Polygon, or `null` to clear it.
   * @throws Any persistence error raised by TypeORM.
   */
  async setTrackCone(
    id: string,
    track: LineString | null,
    cone: Polygon | null,
  ): Promise<void> {
    await this.advisoriesRepository.update(id, {
      track,
      cone,
    });
  }

  /**
   * Replace all coastal watch/warning segments belonging to an advisory.
   *
   * The existing warning rows are deleted before the supplied segments are
   * inserted. An empty segment list therefore intentionally clears all
   * previously stored warnings.
   *
   * @param advisory Owning advisory entity.
   * @param segments New warning segments to persist.
   * @returns Number of warning segments inserted.
   * @throws Any persistence error raised while deleting or saving warnings.
   */
  async replaceWarnings(
    advisory: Advisory,
    segments: WarningSegmentDto[],
  ): Promise<number> {
    await this.warningsRepository.delete({
      advisory: {
        id: advisory.id,
      },
    });

    if (segments.length === 0) {
      return 0;
    }

    const entities = this.warningsRepository.create(
      segments.map((segment) => ({
        advisory,
        warningType: segment.warningType,
        geometry: segment.geometry,
      })),
    );

    await this.warningsRepository.save(entities);

    return entities.length;
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

  /**
   * Insert an advisory for a storm without creating duplicates.
   *
   * The database performs the conflict handling through
   * `INSERT ... ON CONFLICT DO NOTHING`, which avoids a find-then-insert
   * race between concurrent ingestion workers.
   *
   * The advisory is subsequently queried regardless of whether the insert
   * happened. This guarantees that callers receive the existing advisory
   * when the row was already present.
   *
   * @param input Advisory data supplied by the ingestion pipeline.
   * @returns The existing or newly inserted advisory and whether a new row
   * was actually inserted.
   * @throws Any persistence error raised by TypeORM.
   */
  async upsertFromIngestion(input: {
    /** Owning storm. */
    storm: Storm;

    /** NHC advisory number. */
    advisoryNumber: number;

    /** Advisory issue timestamp. */
    issuedAt: Date;

    /** Original advisory text, when available. */
    rawText: string | null;
  }): Promise<{ advisory: Advisory; inserted: boolean }> {
    const result = await this.advisoriesRepository
      .createQueryBuilder()
      .insert()
      .into(Advisory)
      .values({
        storm: input.storm,
        advisoryNumber: input.advisoryNumber,
        issuedAt: input.issuedAt,
        rawText: input.rawText,
      })
      .orIgnore()
      .execute();

    /*
     * For an actually inserted generated UUID, TypeORM exposes a non-null
     * identifier. For a skipped ON CONFLICT operation, identifiers may be
     * empty or contain null, depending on the driver/version.
     */
    const inserted = result.identifiers.some(
      (identifier) => identifier != null,
    );

    const advisory = await this.advisoriesRepository.findOneOrFail({
      where: {
        storm: {
          atcfId: input.storm.atcfId,
        },
        advisoryNumber: input.advisoryNumber,
      },
    });

    return {
      advisory,
      inserted,
    };
  }

  async replaceForecastPoints(
    advisory: Advisory,
    points: ForecastPointDto[],
  ): Promise<number> {
    await this.forecastPointsRepository.delete({
      advisory: { id: advisory.id },
    });

    if (points.length === 0) return 0;

    const entities = this.forecastPointsRepository.create(
      points.map((p) => ({
        advisory,
        validAt: p.validAt,
        latitude: p.latitude,
        longitude: p.longitude,
        windSpeedKt: p.windSpeedKt,
        pressureMb: p.pressureMb,
        category: categoryFromWindKt(p.windSpeedKt),
      })),
    );

    await this.forecastPointsRepository.save(entities);
    return entities.length;
  }
}
