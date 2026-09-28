import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LineString, Polygon } from 'geojson';
import { Advisory } from '../../../weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../../weather/advisories/entities/forecast-point.entity.js';
import { Warning } from '../../../weather/advisories/entities/warning.entity.js';
import { Storm } from '../../../weather/storms/entities/storm.entity.js';
import { categoryFromWindKt } from '../../../weather/storms/storm-category.js';
import type { ForecastPointDto } from '../../../../common/contracts/forecast-point.dto.js';
import type { WarningSegmentDto } from '../../../../common/contracts/warning-segment.dto.js';

/**
 * Every write to the advisory side of the schema, and nothing else.
 *
 * Same reasoning as StormWriter: these four methods used to sit on
 * AdvisoriesService, which exists to answer the API's questions, and the
 * ingestion was reaching into a reader to write.
 *
 * `upsert` is the interesting one. It inserts with `orIgnore` and then reports
 * whether a row was actually created, which is what tells the caller whether
 * the advisory is new. A subsequent `findOneOrFail` gives back the row either
 * way, so a re-published advisory is recognised and skipped rather than
 * duplicated.
 */
@Injectable()
export class AdvisoryWriter {
  private readonly logger = new Logger(AdvisoryWriter.name);

  constructor(
    @InjectRepository(Advisory)
    private readonly advisories: Repository<Advisory>,
    @InjectRepository(ForecastPoint)
    private readonly forecastPoints: Repository<ForecastPoint>,
    @InjectRepository(Warning)
    private readonly warnings: Repository<Warning>,
  ) {}

  /**
   * Insert an advisory if it does not exist yet.
   *
   * @returns the advisory, and whether this call created it.
   */
  async upsert(input: {
    storm: Storm;
    advisoryNumber: number;
    issuedAt: Date;
    rawText: string | null;
  }): Promise<{ advisory: Advisory; inserted: boolean }> {
    const result = await this.advisories
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

    const advisory = await this.advisories.findOneOrFail({
      where: {
        storm: { atcfId: input.storm.atcfId },
        advisoryNumber: input.advisoryNumber,
      },
    });

    return { advisory, inserted };
  }

  async setTrackCone(
    id: string,
    track: LineString | null,
    cone: Polygon | null,
  ): Promise<void> {
    await this.advisories.update(id, { track, cone });
  }

  /**
   * Replace every forecast point of an advisory.
   *
   * An empty list therefore clears them, which is what a storm that has stopped
   * publishing track data should do rather than keeping the last known points
   * forever.
   *
   * @returns Number of forecast points inserted.
   */
  async replaceForecastPoints(
    advisory: Advisory,
    points: ForecastPointDto[],
  ): Promise<number> {
    await this.forecastPoints.delete({ advisory: { id: advisory.id } });

    if (points.length === 0) return 0;

    const entities = this.forecastPoints.create(
      points.map((p) => ({
        advisory,
        validAt: p.validAt,
        latitude: p.latitude,
        longitude: p.longitude,
        windSpeedKt: p.windSpeedKt,
        pressureMb: p.pressureMb,
        // Derived here rather than trusted from the feed: category is a
        // function of wind speed, and two places computing it is two places to
        // disagree.
        category: categoryFromWindKt(p.windSpeedKt),
      })),
    );

    await this.forecastPoints.save(entities);
    return entities.length;
  }

  /**
   * Replace every watch/warning segment of an advisory. An empty list clears
   * the previous ones.
   *
   * @returns Number of warning segments inserted.
   */
  async replaceWarnings(
    advisory: Advisory,
    segments: WarningSegmentDto[],
  ): Promise<number> {
    await this.warnings.delete({ advisory: { id: advisory.id } });

    if (segments.length === 0) return 0;

    const entities = this.warnings.create(
      segments.map((segment) => ({
        advisory,
        warningType: segment.warningType,
        geometry: segment.geometry,
      })),
    );

    await this.warnings.save(entities);

    return entities.length;
  }
}
