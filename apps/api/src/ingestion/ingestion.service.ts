import { Injectable, Logger } from '@nestjs/common';
import { NhcProvider, NhcBasin } from '../providers/nhc/nhc.provider.js';
import {
  parseRssFeed,
  extractStormSummaries,
  parseForecastPoints,
} from '../providers/nhc/nhc-parser.js';
import {
  parseKmz,
  parseTrackKml,
  parseConeKml,
  parseWatchWarningsKml,
} from '../providers/nhc/kml-parser.js';
import { StormsService } from '../storms/storms.service.js';
import { AdvisoriesService } from '../advisories/advisories.service.js';
import { ForecastPointsService } from '../forecast-points/forecast-points.service.js';

/** Counters describing the outcome of one ingestion run for a basin. */
export interface IngestReport {
  basin: NhcBasin;
  stormsSeen: number;
  stormsUpserted: number;
  advisoriesInserted: number;
  advisoriesSkipped: number;
  forecastPointsInserted: number;
  geometriesUpdated: number;
  warningSegments: number;
  errors: string[];
}

/** Alias kept for Swagger: the controller returns the shape of {@link IngestReportDto}. */
export type { IngestReportDto } from './dto/ingest-report.dto.js';

/**
 * Pulls the latest NHC data into the database.
 *
 * For each basin the service: (1) fetches the storm summary feed, (2) upserts
 * every active storm, (3) fetches each storm's TCM forecast-advisory, (4)
 * replaces that advisory's forecast points, and (5) stores the advisory's
 * track/cone geometry and coastal watch/warning segments from NHC's KMZ
 * products. Failures are collected and reported instead of aborting the run.
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly nhc: NhcProvider,
    private readonly storms: StormsService,
    private readonly advisories: AdvisoriesService,
    private readonly forecastPoints: ForecastPointsService,
  ) {}

  /**
   * Ingest a single basin and return its {@link IngestReport}.
   *
   * Never throws; unexpected errors are recorded in `report.errors` so the
   * run can continue to the next storm/basin.
   */
  async ingestBasin(basin: NhcBasin): Promise<IngestReport> {
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

    let summaries;
    try {
      const xml = await this.nhc.fetchBasinSummary(basin);
      const feed = parseRssFeed(xml);
      summaries = extractStormSummaries(feed);
    } catch (err) {
      const msg = `basin=${basin} fetch/parse failed: ${(err as Error).message}`;
      this.logger.error(msg);
      report.errors.push(msg);
      return report;
    }

    report.stormsSeen = summaries.length;
    if (summaries.length === 0) {
      this.logger.log(
        `ingest basin=${basin} no active storms (${Date.now() - started}ms)`,
      );
      return report;
    }

    for (const summary of summaries) {
      const stormStarted = Date.now();
      const ctx = `basin=${basin} atcfId=${summary.atcfId} wallet=${summary.wallet}`;
      try {
        const storm = await this.storms.upsertFromIngestion({
          atcfId: summary.atcfId,
          name: summary.name,
          basin: summary.basin,
        });
        report.stormsUpserted++;

        // Fetch the TCM advisory to get forecast points
        let tcmXml: string;
        try {
          tcmXml = await this.nhc.fetchForecastAdvisory(summary.wallet);
        } catch (err) {
          const msg = `${ctx} TCM fetch failed: ${(err as Error).message}`;
          this.logger.warn(msg);
          report.errors.push(msg);
          continue;
        }

        const tcmFeed = parseRssFeed(tcmXml);
        const tcmItem = tcmFeed.items[0];

        // Advisory number: derive from the TCM title "… Forecast/Advisory Number 2"
        const advisoryNumber = extractAdvisoryNumber(tcmItem.title);
        if (advisoryNumber === null) {
          const msg = `${ctx} could not parse advisory number from "${tcmItem.title}"`;
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
            `${ctx} advisory#${advisoryNumber} inserted (${Date.now() - stormStarted}ms)`,
          );
        } else {
          report.advisoriesSkipped++;
          this.logger.log(
            `${ctx} advisory#${advisoryNumber} already present, skipped`,
          );
        }

        // Parse forecast points from CDATA
        if (rawText) {
          const points = parseForecastPoints(rawText, issuedAt);
          const n = await this.forecastPoints.replaceForAdvisory(
            advisory,
            points,
          );
          report.forecastPointsInserted += n;
        }

        // Track and cone geometry from the advisory KMZ products
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
          const msg = `${ctx} geometry fetch failed: ${(err as Error).message}`;
          this.logger.warn(msg);
          report.errors.push(msg);
        }

        // Coastal watch/warning segments (published only while active)
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
          const msg = `${ctx} warnings fetch failed: ${(err as Error).message}`;
          this.logger.warn(msg);
          report.errors.push(msg);
        }
      } catch (err) {
        const msg = `${ctx} storm processing failed: ${(err as Error).message}`;
        this.logger.error(msg);
        report.errors.push(msg);
      }
    }

    this.logger.log(
      `ingest basin=${basin} storms+${report.stormsUpserted} advisories+${report.advisoriesInserted}/~${report.advisoriesSkipped} points+${report.forecastPointsInserted} errors=${report.errors.length} took=${Date.now() - started}ms`,
    );
    return report;
  }

  /** Ingest every tracked basin (Atlantic, East Pacific, Central Pacific). */
  async ingestAllBasins(): Promise<IngestReport[]> {
    const basins: NhcBasin[] = ['at', 'ep', 'cp'];
    const reports: IngestReport[] = [];
    for (const b of basins) {
      reports.push(await this.ingestBasin(b));
    }
    return reports;
  }
}

/**
 * Extract the advisory number from a TCM title like
 * "… FORECAST/ADVISORY NUMBER 2 …". Returns null when absent.
 */
function extractAdvisoryNumber(title: string): number | null {
  const m = title.match(/Number\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}
