import { Injectable, Logger } from '@nestjs/common';
import { NhcProvider, NhcBasin } from './nhc.provider.js';
import {
  parseRssFeed,
  extractStormSummaries,
  parseForecastPoints,
} from './nhc-parser.js';
import { StormsService } from '../storms/storms.service.js';
import { AdvisoriesService } from '../advisories/advisories.service.js';
import { ForecastPointsService } from '../forecast-points/forecast-points.service.js';

export interface IngestReport {
  basin: NhcBasin;
  stormsSeen: number;
  stormsUpserted: number;
  advisoriesInserted: number;
  advisoriesSkipped: number;
  forecastPointsInserted: number;
  errors: string[];
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly nhc: NhcProvider,
    private readonly storms: StormsService,
    private readonly advisories: AdvisoriesService,
    private readonly forecastPoints: ForecastPointsService,
  ) {}

  async ingestBasin(basin: NhcBasin): Promise<IngestReport> {
    const report: IngestReport = {
      basin,
      stormsSeen: 0,
      stormsUpserted: 0,
      advisoriesInserted: 0,
      advisoriesSkipped: 0,
      forecastPointsInserted: 0,
      errors: [],
    };

    let summaries;
    try {
      const xml = await this.nhc.fetchBasinSummary(basin);
      const feed = parseRssFeed(xml);
      summaries = extractStormSummaries(feed);
    } catch (err) {
      const msg = `Failed to fetch/parse ${basin}: ${(err as Error).message}`;
      this.logger.error(msg);
      report.errors.push(msg);
      return report;
    }

    report.stormsSeen = summaries.length;
    if (summaries.length === 0) {
      this.logger.log(`Basin ${basin}: no active storms`);
      return report;
    }

    for (const summary of summaries) {
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
          const msg = `TCM fetch failed for wallet ${summary.wallet}: ${(err as Error).message}`;
          this.logger.warn(msg);
          report.errors.push(msg);
          continue;
        }

        const tcmFeed = parseRssFeed(tcmXml);
        const tcmItem = tcmFeed.items[0];

        // Advisory number: derive from the TCM title "… Forecast/Advisory Number 2"
        const advisoryNumber = extractAdvisoryNumber(tcmItem.title);
        if (advisoryNumber === null) {
          const msg = `Could not parse advisory number from "${tcmItem.title}"`;
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
        if (inserted) report.advisoriesInserted++;
        else report.advisoriesSkipped++;

        // Parse forecast points from CDATA
        if (rawText) {
          const points = parseForecastPoints(rawText, issuedAt);
          const n = await this.forecastPoints.replaceForAdvisory(
            advisory,
            points,
          );
          report.forecastPointsInserted += n;
        }
      } catch (err) {
        const msg = `Storm ${summary.atcfId} failed: ${(err as Error).message}`;
        this.logger.error(msg);
        report.errors.push(msg);
      }
    }

    this.logger.log(
      `Basin ${basin}: storms=${report.stormsUpserted}, advisories+${report.advisoriesInserted}/~${report.advisoriesSkipped}, points+${report.forecastPointsInserted}, errors=${report.errors.length}`,
    );
    return report;
  }

  async ingestAllBasins(): Promise<IngestReport[]> {
    const basins: NhcBasin[] = ['at', 'ep', 'cp'];
    const reports: IngestReport[] = [];
    for (const b of basins) {
      reports.push(await this.ingestBasin(b));
    }
    return reports;
  }
}

// "… Forecast/Advisory Number 2" → 2
function extractAdvisoryNumber(title: string): number | null {
  const m = title.match(/Number\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}
