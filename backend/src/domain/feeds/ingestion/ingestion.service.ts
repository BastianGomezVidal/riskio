import { Inject, Injectable, Logger } from '@nestjs/common';
import { BASIN_NAMES, BasinName } from '../../../shared/basin/basin.js';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import {
  parseRssFeed,
  extractStormSummaries,
  parseForecastPoints,
} from '../parser/nhc-parser.js';
import {
  parseKmz,
  parseTrackKml,
  parseConeKml,
  parseWatchWarningsKml,
} from '../parser/kml-parser.js';
import { StormsService } from '../../weather/storms/storms.service.js';
import { AdvisoriesService } from '../../weather/advisories/advisories.service.js';
import { CACHE_SERVICE } from '../../cache/cache.tokens.js';
import type { CacheService } from '../../cache/cache.service.js';

/**
 * Counters describing the outcome of one ingestion run for a basin.
 */
export interface IngestReport {
  basin: BasinName;
  stormsSeen: number;
  stormsUpserted: number;
  advisoriesInserted: number;
  advisoriesSkipped: number;
  forecastPointsInserted: number;
  geometriesUpdated: number;
  warningSegments: number;
  errors: string[];
}

/**
 * Re-exported for consumers that use the ingestion service module.
 */
export type { IngestReportDto } from './dto/ingest-report.dto.js';

/**
 * Pulls the latest NHC data into the database.
 *
 * For each basin the service:
 * 1. Fetches the storm summary RSS feed.
 * 2. Upserts every active storm.
 * 3. Fetches each storm's TCM forecast advisory.
 * 4. Stores the advisory and replaces its forecast points.
 * 5. Stores the advisory's track and cone geometry.
 * 6. Stores coastal watch/warning segments when published.
 *
 * Forecast-point persistence is required before geometry and warning data
 * are processed for an advisory.
 *
 * Individual failures are collected in the ingestion report instead of
 * aborting the entire basin run.
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly nhc: NhcProvider,
    private readonly storms: StormsService,
    private readonly advisories: AdvisoriesService,
    @Inject(CACHE_SERVICE)
    private readonly cache: CacheService,
  ) {}

  /**
   * Ingests the latest NHC data for a single basin.
   *
   * Errors are recorded in {@link IngestReport.errors} and do not cause the
   * method to throw. A failure while processing one storm does not prevent
   * the remaining storms in the basin from being processed.
   *
   * @param basin The NHC basin to ingest.
   * @returns A report containing ingestion counters and any errors encountered.
   */
  async ingestBasin(basin: BasinName): Promise<IngestReport> {
    const started = Date.now();

    const report: IngestReport = {
      basin,
      stormsSeen: 0,
      stormsUpserted: 0,
      advisoriesInserted: 0,
      advisoriesSkipped: 0,
      forecastPointsInserted: 0,
      geometriesUpdated: 0,
      warningSegments: 0,
      errors: [],
    };

    let feed;
    let summaries;

    try {
      const xml = await this.nhc.fetchBasinSummary(basin);
      feed = parseRssFeed(xml);
      summaries = extractStormSummaries(feed);
    } catch (err) {
      const msg = `basin=${basin} fetch/parse failed: ${getErrorMessage(err)}`;

      this.logger.error(msg, getErrorStack(err));
      report.errors.push(msg);

      return report;
    }

    report.stormsSeen = summaries.length;

    /*
     * Tell "NOAA genuinely has no storms" apart from "the parser did not
     * recognize what NOAA sent". The first authorizes marking everything
     * inactive; the second would be silent data loss.
     *
     * A legitimately empty feed carries informational items (TWO, "no
     * cyclones") that do NOT include `nhc:Cyclone`. The drift signal is
     * an item that does include the element but from which no valid
     * cyclone could be built (or which lacks a pubDate). In that case we
     * prefer to leave the DB untouched and keep the previous state.
     */
    const failedStormItems = feed.items.filter(
      (item) => item.hasCycloneElement && (!item.cyclone || !item.pubDate),
    );

    if (summaries.length === 0 && failedStormItems.length > 0) {
      const msg =
        `basin=${basin} feed has ${failedStormItems.length} cyclone ` +
        `item(s) but parser extracted 0 storms — refusing to flip ` +
        `activity flags`;

      this.logger.error(msg);
      report.errors.push(msg);

      return report;
    }

    /*
     * Reconcile activity flags before per-storm work. Only a cleanly
     * parsed feed reaches this point — a fetch or parse failure above
     * returned early and leaves the current active set untouched.
     *
     * A reconciliation failure leaves the basin in its prior state (the
     * transaction rolls back), so aborting the rest of this pass is both
     * safe and correct: without the flip, per-storm findOneRaw() would fail
     * for storms unknown to the DB and emit a cascade of noise.
     */
    try {
      await this.storms.reconcileFromFeed(
        basin,
        summaries.map((s) => ({
          atcfId: s.atcfId,
          name: s.name,
          basin: s.basin,
        })),
      );
    } catch (err) {
      const msg =
        `basin=${basin} activity reconciliation failed: ` +
        `${getErrorMessage(err)}`;

      this.logger.error(msg, getErrorStack(err));
      report.errors.push(msg);

      return report;
    }

    if (summaries.length === 0) {
      this.logger.log(
        `ingest basin=${basin} no active storms, all marked inactive ` +
          `(${Date.now() - started}ms)`,
      );

      return report;
    }

    for (const summary of summaries) {
      const stormStarted = Date.now();
      const ctx = `basin=${basin} atcfId=${summary.atcfId} wallet=${summary.wallet}`;

      try {
        // The storm was already inserted/updated by reconcileFromFeed.
        // Here we only load it to hand it to the advisories.
        const storm = await this.storms.findOneRaw(summary.atcfId);

        report.stormsUpserted++;

        /*
         * Fetch the TCM advisory.
         *
         * The advisory is required for forecast points, geometry, and
         * warning data, so failure here prevents further processing of
         * this storm.
         */
        let tcmXml: string;

        try {
          tcmXml = await this.nhc.fetchForecastAdvisory(summary.wallet);
        } catch (err) {
          const msg = `${ctx} TCM fetch failed: ${getErrorMessage(err)}`;

          this.logger.warn(msg);
          report.errors.push(msg);

          continue;
        }

        const tcmFeed = parseRssFeed(tcmXml);
        const tcmItem = tcmFeed.items[0];

        if (!tcmItem) {
          const msg = `${ctx} TCM feed contains no items`;

          this.logger.warn(msg);
          report.errors.push(msg);

          continue;
        }

        const advisoryNumber = extractAdvisoryNumber(tcmItem.title);

        if (advisoryNumber === null) {
          const msg =
            `${ctx} could not parse advisory number from ` +
            `"${tcmItem.title}"`;

          this.logger.warn(msg);
          report.errors.push(msg);

          continue;
        }

        const issuedAt = tcmItem.pubDate ?? summary.issuedAt;
        const rawText = tcmItem.description ?? null;

        const { advisory, inserted } =
          await this.advisories.upsertFromIngestion({
            storm,
            advisoryNumber,
            issuedAt,
            rawText,
          });

        if (inserted) {
          report.advisoriesInserted++;

          this.logger.log(
            `${ctx} advisory#${advisoryNumber} inserted ` +
              `(${Date.now() - stormStarted}ms)`,
          );

          // Bust the cache so the next request picks up the new advisory.
          await this.cache.invalidate('dashboard:*');
          await this.cache.invalidate('storms:*');
        } else {
          report.advisoriesSkipped++;

          this.logger.log(
            `${ctx} advisory#${advisoryNumber} already present, skipped`,
          );
        }

        /*
         * Forecast points are a prerequisite for the remaining advisory
         * processing. If this operation fails, the per-storm catch below
         * records the error and skips geometry and warning processing.
         */
        if (rawText) {
          const points = parseForecastPoints(rawText, issuedAt);

          const n = await this.advisories.replaceForecastPoints(
            advisory,
            points,
          );

          report.forecastPointsInserted += n;

          if (n === 0) {
            continue;
          }
        }

        /*
         * Track and cone geometry from the advisory KMZ products.
         */
        try {
          const [trackKmz, coneKmz] = await Promise.all([
            this.nhc.fetchAdvisoryProduct(
              storm.atcfId,
              advisoryNumber,
              'TRACK',
            ),
            this.nhc.fetchAdvisoryProduct(storm.atcfId, advisoryNumber, 'CONE'),
          ]);

          const track = trackKmz
            ? (parseTrackKml(parseKmz(trackKmz))?.lineString ?? null)
            : null;

          const cone = coneKmz
            ? (parseConeKml(parseKmz(coneKmz))?.polygon ?? null)
            : null;

          await this.advisories.setTrackCone(advisory.id, track, cone);

          if (track || cone) {
            report.geometriesUpdated++;
          }
        } catch (err) {
          const msg = `${ctx} geometry fetch failed: ${getErrorMessage(err)}`;

          this.logger.warn(msg);
          report.errors.push(msg);
        }

        /*
         * Coastal watch/warning segments are published only while active.
         * A missing WW product therefore results in an empty replacement.
         */
        try {
          const wwKmz = await this.nhc.fetchAdvisoryProduct(
            storm.atcfId,
            advisoryNumber,
            'WW',
          );

          const segments = wwKmz ? parseWatchWarningsKml(parseKmz(wwKmz)) : [];

          const n = await this.advisories.replaceWarnings(
            advisory,
            segments.map((segment) => ({
              warningType: segment.type,
              geometry: segment.lineString,
            })),
          );

          report.warningSegments += n;
        } catch (err) {
          const msg = `${ctx} warnings fetch failed: ${getErrorMessage(err)}`;

          this.logger.warn(msg);
          report.errors.push(msg);
        }
      } catch (err) {
        const msg = `${ctx} storm processing failed: ${getErrorMessage(err)}`;

        this.logger.error(msg, getErrorStack(err));
        report.errors.push(msg);
      }
    }

    this.logger.log(
      `ingest basin=${basin} storms+${report.stormsUpserted} ` +
        `advisories+${report.advisoriesInserted}/~${report.advisoriesSkipped} ` +
        `points+${report.forecastPointsInserted} ` +
        `errors=${report.errors.length} ` +
        `took=${Date.now() - started}ms`,
    );

    return report;
  }

  /**
   * Ingests all NHC basins defined in the shared basin configuration.
   *
   * Basins are processed sequentially so that ingestion does not generate
   * concurrent upstream requests for every basin.
   *
   * @returns One ingestion report for each configured basin.
   */
  async ingestAllBasins(): Promise<IngestReport[]> {
    const reports: IngestReport[] = [];

    for (const basin of BASIN_NAMES) {
      reports.push(await this.ingestBasin(basin));
    }

    return reports;
  }
}

/**
 * Extracts the advisory number from an NHC TCM title.
 *
 * For example, a title containing "FORECAST/ADVISORY NUMBER 2" returns `2`.
 * The match is case-insensitive and allows one or more whitespace characters
 * between "Number" and the numeric value.
 *
 * @param title The TCM advisory title.
 * @returns The advisory number, or `null` when no number can be extracted.
 */
function extractAdvisoryNumber(title: string): number | null {
  const match = title.match(/Number\s+(\d+)/i);

  return match ? Number(match[1]) : null;
}

/**
 * Converts an unknown thrown value into a useful error message.
 *
 * @param error The value caught by a `catch` clause.
 * @returns A human-readable error message.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Extracts an error stack when the thrown value is an Error.
 *
 * @param error The value caught by a `catch` clause.
 * @returns The error stack, or `undefined` for non-Error values.
 */
function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
