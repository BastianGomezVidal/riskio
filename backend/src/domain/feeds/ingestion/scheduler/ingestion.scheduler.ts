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
 * Runs only in the worker. Both `main.ts` and `main.worker.ts` bootstrap the
 * same `AppModule`, so without this guard the HTTP API also held the cron and
 * every basin was polled twice per interval: twice the requests to NHC and
 * twice the writes. The writes are idempotent, so nothing was corrupted, but
 * it also defeated the reason the worker exists at all — keeping the polling
 * alive across an API restart.
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
    if (process.env.IS_WORKER !== 'true') {
      this.logger.log('not the worker, skipping scheduled ingest');
      return;
    }

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
