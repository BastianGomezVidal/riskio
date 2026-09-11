import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LineString, Polygon } from 'geojson';
import { FeatureCollection } from 'geojson';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';
import { PageMetaDto } from '../common/dto/page-meta.dto.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { ForecastPoint } from '../forecast-points/entities/forecast-point.entity.js';

/** An advisory expanded with its forecast track points. */
export interface AdvisoryDetail extends Advisory {
  forecastPoints: ForecastPoint[];
}

/** A coastal watch/warning value object, as exchanged with the ingestion layer. */
export interface WarningSegmentDto {
  warningType: string;
  geometry: LineString;
}

@Injectable()
export class AdvisoriesService {
  constructor(
    @InjectRepository(Advisory)
    private readonly advisoriesRepository: Repository<Advisory>,
    @InjectRepository(Warning)
    private readonly warningsRepository: Repository<Warning>,
  ) {}

  /**
   * List a storm's advisories newest-first, paginated.
   *
   * @param stormAtcfId ATCF identifier of the owning storm.
   * @param page 1-indexed pagination parameters (`page`, `limit`).
   * @returns paginated advisories ordered by `advisoryNumber` descending.
   */
  async findByStorm(
    stormAtcfId: string,
    page: PageQueryDto,
  ): Promise<PaginatedResultDto<Advisory>> {
    const [data, total] = await this.advisoriesRepository.findAndCount({
      where: { storm: { atcfId: stormAtcfId } },
      order: { advisoryNumber: 'DESC' },
      skip: (page.page - 1) * page.limit,
      take: page.limit,
    });

    const meta: PageMetaDto = {
      total,
      page: page.page,
      limit: page.limit,
      pageCount: Math.ceil(total / page.limit),
      hasNextPage: page.page * page.limit < total,
    };
    return new PaginatedResultDto(meta, data);
  }

  /**
   * Fetch one advisory by UUID with its forecast points and warnings.
   *
   * @throws NotFoundException when no advisory matches.
   */
  async findOne(id: string): Promise<AdvisoryDetail> {
    const advisory = await this.advisoriesRepository.findOne({
      where: { id },
      relations: { forecastPoints: true, warnings: true },
    });
    if (!advisory) {
      throw new NotFoundException(`Advisory ${id} not found`);
    }
    return advisory as AdvisoryDetail;
  }

  /**
   * Replace an advisory's track and cone geometry.
   *
   * Both values arrive as GeoJSON objects and are stored as PostGIS
   * `geography` columns; `null` clears a product (e.g. a cone that was never
   * published for the advisory).
   *
   * @param id advisory UUID.
   * @param track forecast track polyline, or `null` to clear it.
   * @param cone cone-of-uncertainty polygon, or `null` to clear it.
   */
  async setTrackCone(
    id: string,
    track: LineString | null,
    cone: Polygon | null,
  ): Promise<void> {
    await this.advisoriesRepository.update(id, { track, cone });
  }

  /**
   * Replace all coastal watch/warning segments of an advisory.
   *
   * Products are refreshed on every poll, so each call starts from a clean
   * slate — the same replace strategy forecast points use.
   *
   * @param advisory owning advisory entity.
   * @param segments watch/warning segments to store.
   * @returns the number of segments stored.
   */
  async replaceWarnings(
    advisory: Advisory,
    segments: WarningSegmentDto[],
  ): Promise<number> {
    await this.warningsRepository.delete({
      advisory: { id: advisory.id },
    });

    if (segments.length === 0) return 0;

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
   * Fetch an advisory's coastal watch/warning segments as a GeoJSON
   * FeatureCollection, ready for map overlays.
   *
   * @param id advisory UUID.
   * @throws NotFoundException when no advisory matches.
   */
  async findWarnings(id: string): Promise<FeatureCollection> {
    const advisories = await this.advisoriesRepository.exists({
      where: { id },
    });
    if (!advisories) {
      throw new NotFoundException(`Advisory ${id} not found`);
    }

    const warnings = await this.warningsRepository.find({
      where: { advisory: { id } },
    });

    return {
      type: 'FeatureCollection',
      features: warnings.map((warning) => ({
        type: 'Feature',
        properties: { warningType: warning.warningType },
        geometry: warning.geometry,
      })),
    };
  }

  /**
   * Insert an advisory for a storm, or skip when it already exists.
   *
   * @returns the advisory and whether the row was genuinely inserted.
   */
  async upsertFromIngestion(input: {
    storm: Storm;
    advisoryNumber: number;
    issuedAt: Date;
    rawText: string | null;
  }): Promise<{ advisory: Advisory; inserted: boolean }> {
    // INSERT ... ON CONFLICT DO NOTHING to avoid a find-then-create race.
    // identifier is only returned for actually-inserted rows (the RETURNING
    // clause doesn't match rows skipped due to a unique-violation conflict).
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

    // In TypeORM, a skipped ON CONFLICT row still yields a `null` element in
    // `identifiers`, so detect a real insert by looking for a non-null id.
    const inserted = result.identifiers.some((id) => id != null);

    const advisory = await this.advisoriesRepository.findOneOrFail({
      where: {
        storm: { atcfId: input.storm.atcfId },
        advisoryNumber: input.advisoryNumber,
      },
    });
    return { advisory, inserted };
  }
}
