import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionService } from './ingestion.service.js';

/**
 * Periodic ingestion of all NHC basins.
 */
@Injectable()
export class IngestionScheduler {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(private readonly ingestion: IngestionService) {}

  /**
   * Runs every 10 minutes at second 0.
   * NestJS @Cron uses the `cron` package's 6-field format:
   *   sec min hour day-of-month month day-of-week
   *
   * Delegates to {@link IngestionService.ingestAllBasins} and logs a compact
   * per-basin summary; per-basin failures are reported, never thrown, so one
   * bad basin cannot stop the remaining ones.
   */
  @Cron('0 */10 * * * *')
  async pollAllBasins(): Promise<void> {
    const started = Date.now();
    this.logger.log('scheduled-ingest start');

    try {
      const reports = await this.ingestion.ingestAllBasins();
      const summary = reports
        .map(
          (r) =>
            `${r.basin}:storms=${r.stormsUpserted}/~${r.stormsSeen},adv+${r.advisoriesInserted}/~${r.advisoriesSkipped},pts+${r.forecastPointsInserted},geo+${r.geometriesUpdated},ww+${r.warningSegments},err=${r.errors.length}`,
        )
        .join(' | ');
      const errored = reports.filter((r) => r.errors.length > 0);
      this.logger.log(
        `scheduled-ingest done took=${Date.now() - started}ms ${summary}`,
      );
      if (errored.length > 0) {
        this.logger.warn(
          `scheduled-ingest basins-with-errors=${errored.length} details=${JSON.stringify(errored.map((r) => ({ basin: r.basin, errors: r.errors })))}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `scheduled-ingest failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
