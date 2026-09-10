import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionService } from './ingestion.service.js';

@Injectable()
export class IngestionScheduler {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(private readonly ingestion: IngestionService) {}

  /**
   * Runs every 10 minutes at seconds :00.
   * Cron format: sec min hour day month weekday
   */
  @Cron('0 */10 * * * *')
  async pollAllBasins(): Promise<void> {
    this.logger.log('Scheduled ingestion: starting');
    const started = Date.now();

    try {
      const reports = await this.ingestion.ingestAllBasins();
      const summary = reports
        .map(
          (r) =>
            `${r.basin}:storms=${r.stormsUpserted},adv+${r.advisoriesInserted}/~${r.advisoriesSkipped},pts+${r.forecastPointsInserted},err=${r.errors.length}`,
        )
        .join(' | ');
      this.logger.log(
        `Scheduled ingestion: done in ${Date.now() - started}ms — ${summary}`,
      );
    } catch (err) {
      this.logger.error(
        `Scheduled ingestion failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
