import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BasinName } from '../../../shared/basin/basin.js';
import type { IngestReportDto } from './dto/ingest-report.dto.js';

/**
 * The API's way of asking for an ingestion run.
 *
 * The `admin/ingest/*` endpoints stayed here rather than moving with the
 * ingestion, because they are an admin surface: the api-key and role guards,
 * the users module and the Swagger annotations all live in the API, and moving
 * the controller would have meant moving or duplicating all of it. The
 * alternative — making the feeds service authenticate itself — is the one thing
 * 6.6 explicitly did not want.
 *
 * Failures are *not* swallowed here, unlike the cache client. A manual trigger
 * that silently reports success while nothing was ingested is the exact failure
 * this tool was built to make visible, so the error travels to the caller and
 * the request fails. A scheduled run is a different matter: that one is
 * fire-and-forget and the ingestion service logs its own outcome.
 */
@Injectable()
export class FeedsClientService {
  private readonly logger = new Logger(FeedsClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('FEEDS_SERVICE_URL', 'http://backend-feeds:3006')
      .replace(/\/+$/, '');
    // Generous compared to the cache: a real run fetches several NOAA feeds and
    // writes rows, so a second would be cutting it close.
    this.timeoutMs = Number(config.get('FEEDS_SERVICE_TIMEOUT_MS', 120_000));
  }

  async ingestAllBasins(): Promise<IngestReportDto[]> {
    return this.post<IngestReportDto[]>('/ingest/run');
  }

  async ingestBasin(basin: BasinName): Promise<IngestReportDto> {
    return this.post<IngestReportDto>(
      `/ingest/run/${encodeURIComponent(basin)}`,
    );
  }

  private async post<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `feeds service returned ${response.status} on POST ${path}: ${body.slice(0, 300)}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(
        `ingestion request failed: POST ${path} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
