import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FeatureCollection, LineString, Polygon } from 'geojson';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';
import { PaginatedResultDto } from '../../../common/dto/paginated-result.dto.js';
import { PageMetaDto } from '../../../common/dto/page-meta.dto.js';
import { PageQueryDto } from '../../../common/dto/page-query.dto.js';
import { ForecastPoint } from '../forecast-points/entities/forecast-point.entity.js';

/**
 * An advisory expanded with its associated forecast points.
 */
export interface AdvisoryDetail extends Advisory {
  forecastPoints: ForecastPoint[];
}

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
 * - paginated advisory queries;
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
  ) {}

  /**
   * List a storm's advisories newest-first.
   *
   * Advisories are ordered by advisory number descending so that the most
   * recent advisory appears first.
   *
   * @param stormAtcfId ATCF identifier of the owning storm.
   * @param page 1-indexed pagination parameters.
   * @returns Paginated advisory results and pagination metadata.
   */
  async findByStorm(
    stormAtcfId: string,
    page: PageQueryDto,
  ): Promise<PaginatedResultDto<Advisory>> {
    const skip = (page.page - 1) * page.limit;

    const [data, total] = await this.advisoriesRepository.findAndCount({
      where: {
        storm: {
          atcfId: stormAtcfId,
        },
      },
      order: {
        advisoryNumber: 'DESC',
      },
      skip,
      take: page.limit,
    });

    const pageCount = total === 0 ? 0 : Math.ceil(total / page.limit);

    const meta: PageMetaDto = {
      total,
      page: page.page,
      limit: page.limit,
      pageCount,
      hasNextPage: page.page * page.limit < total,
    };

    return new PaginatedResultDto(meta, data);
  }

  /**
   * Fetch one advisory by UUID with its forecast points and warnings.
   *
   * @param id Advisory UUID.
   * @returns The advisory including forecast points and warning relations.
   * @throws NotFoundException when no advisory matches the supplied UUID.
   */
  async findOne(id: string): Promise<AdvisoryDetail> {
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

    return advisory as AdvisoryDetail;
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
   * Fetch an advisory's coastal watch/warning segments as GeoJSON.
   *
   * The advisory existence check is performed separately so that an
   * advisory with zero warnings can correctly return an empty
   * FeatureCollection while an unknown advisory returns 404.
   *
   * @param id Advisory UUID.
   * @returns GeoJSON FeatureCollection containing warning LineStrings.
   * @throws NotFoundException when the advisory does not exist.
   */
  async findWarnings(id: string): Promise<FeatureCollection> {
    const exists = await this.advisoriesRepository.exists({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException(`Advisory ${id} not found`);
    }

    const warnings = await this.warningsRepository.find({
      where: {
        advisory: {
          id,
        },
      },
    });

    return {
      type: 'FeatureCollection',
      features: warnings.map((warning) => ({
        type: 'Feature',
        properties: {
          warningType: warning.warningType,
        },
        geometry: warning.geometry,
      })),
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
}
