import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionService } from '../ingestion.service.js';

/**
 * Periodic ingestion of all NHC basins.
 *
 * A failed storm is not retried immediately. The next scheduled execution
 * will fetch the RSS feed again and retry any storm that failed during the
 * previous run.
 *
 * The `IS_WORKER` guard is gone, and that is the point of the extraction. It
 * existed because `main.ts` and `main.worker.ts` bootstrapped the same
 * AppModule, so the API also held the cron and every basin was polled twice per
 * interval. This scheduler now lives in the feeds service alone, next to the
 * ingestion it drives, and nothing else has a copy — so there is nothing left
 * to guard against.
 */
@Injectable()
export class IngestionScheduler {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(private readonly ingestion: IngestionService) {}

  /**
   * Runs every 10 minutes at second 0.
   *
   * NestJS @Cron uses the cron package's 6-field format:
   *   sec min hour day-of-month month day-of-week
   *
   * Per-storm and per-basin errors are captured by IngestionService, so one
   * failed storm does not prevent the remaining storms or basins from being
   * processed. A subsequent scheduled run provides the retry mechanism.
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
          `scheduled-ingest basins-with-errors=${errored.length} ` +
            `details=${JSON.stringify(
              errored.map((r) => ({
                basin: r.basin,
                stormsSeen: r.stormsSeen,
                stormsUpserted: r.stormsUpserted,
                errors: r.errors,
              })),
            )}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      this.logger.error(`scheduled-ingest failed: ${message}`, stack);
    }
  }
}
