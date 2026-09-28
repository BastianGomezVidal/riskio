import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The dashboard's way of reading storms and advisories.
 *
 * The weather domain left the API, so this replaced two injections: a
 * `Repository<Storm>` and the `AdvisoriesService`. Both are HTTP now.
 *
 * Fails open on the *cache* (the cache client already does) but **not** on a
 * dead weather service. The dashboard's whole content is storms, so a degraded
 * empty summary would be a plausible-looking lie; an error is the honest
 * answer, and it is what makes "weather is down" visible on the dashboard
 * instead of showing zero hurricanes.
 */
@Injectable()
export class WeatherClientService {
  private readonly logger = new Logger(WeatherClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('WEATHER_SERVICE_URL', 'http://backend-weather:3007')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get('WEATHER_SERVICE_TIMEOUT_MS', 5_000));
  }

  activeStorms(): Promise<unknown[]> {
    return this.get<unknown[]>('/internal/weather/active-storms');
  }

  latestAdvisoriesPerStorm(atcfIds: string[]): Promise<unknown[]> {
    if (atcfIds.length === 0) return Promise.resolve([]);
    return this.get<unknown[]>(
      `/internal/weather/latest-per-storm?atcfIds=${encodeURIComponent(atcfIds.join(','))}`,
    );
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `weather service returned ${response.status} on GET ${path}: ${body.slice(0, 200)}`,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(
        `weather read failed: GET ${path} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
