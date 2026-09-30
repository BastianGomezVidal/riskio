import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CacheService } from './cache.service.js';

/**
 * Talks to the cache service over HTTP.
 *
 * Everything here fails open, and that is the whole design decision of this
 * extraction. A cache is a performance choice, and a cache that can take the
 * application down with it has been given too much authority: before the
 * extraction, a Redis hiccup meant `cache.get` rejected, `getOrSet` never
 * reached its loader, and a request that needed one aggregated number failed
 * outright — for data that was sitting in the database the whole time.
 *
 * So every call catches, warns once, and returns the "empty cache" answer. The
 * caller runs its loader and the page renders slower, which is the intended
 * degradation. `invalidate` swallows too: a stale cache entry is a wrong number
 * for up to 30 seconds, and failing an ingestion run over it is worse.
 *
 * `getOrSet` stays as a method rather than becoming a remote operation because
 * the loader is code and code cannot run on the other side of a socket.
 */
@Injectable()
export class HttpCacheService implements CacheService {
  private readonly logger = new Logger(HttpCacheService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cooldownMs: number;
  /**
   * When the service last failed, and whether that failure has been reported.
   *
   * Not just a "do not log it again" flag. A cache in front of a dead service
   * still pays the full timeout on every read, and a miss costs two calls, so a
   * 2 s timeout turned into ~4 s responses — slower than the database work the
   * cache was there to avoid. Measured, not theorised. After one failure the
   * calls are skipped for the cooldown and the caller goes straight to its
   * loader, which is the degradation that was actually intended.
   */
  private lastFailureAt = 0;
  private outageReported = false;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('CACHE_SERVICE_URL', 'http://cache:3005')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get('CACHE_SERVICE_TIMEOUT_MS', 1_000));
    this.cooldownMs = Number(config.get('CACHE_SERVICE_COOLDOWN_MS', 10_000));
  }

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.call<{ found: boolean; value: T | null }>(
      `/cache/${encodeURIComponent(key)}`,
      'GET',
    );
    return result?.found ? (result.value as T) : undefined;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.call('/cache', 'PUT', { key, value, ttlMs: Number(ttlMs) });
  }

  async del(key: string): Promise<void> {
    await this.call(`/cache/${encodeURIComponent(key)}`, 'DELETE');
  }

  async invalidate(pattern: string): Promise<number> {
    const result = await this.call<{ deleted: number }>(
      '/cache/invalidate',
      'POST',
      {
        pattern,
      },
    );
    if (!result) return 0;
    if (result.deleted) {
      this.logger.log(
        `Invalidated ${result.deleted} keys for pattern ${pattern}`,
      );
    }
    return result.deleted;
  }

  /**
   * Read-through, composed locally. The loader runs here because it is a
   * function; only the storage lives elsewhere.
   */
  async getOrSet<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Returns null on any failure, after warning. The callers all treat that as
   * "no cached value", so one implementation of the fail-open policy covers
   * every operation instead of each one remembering to catch.
   */
  private async call<T>(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<T | null> {
    // Skipping is what makes the degradation cheap. Retrying on a fixed
    // schedule would keep the first post-cooldown request slow, but the rest of
    // the burst would be fine, which is the wrong trade for a dependency that
    // is either up or down.
    if (this.inCooldown()) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: AbortSignal.timeout(this.timeoutMs),
        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `cache service returned ${response.status} on ${method} ${path}: ${text.slice(0, 200)}`,
        );
      }

      // 204 on DELETE has no body to parse, and asking for one throws.
      if (response.status === 204) {
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.lastFailureAt = Date.now();
      if (!this.outageReported) {
        this.outageReported = true;
        this.logger.warn(
          `cache service unreachable, degrading to uncached reads for ${this.cooldownMs}ms: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      return null;
    }
  }

  private inCooldown(): boolean {
    if (this.lastFailureAt === 0) return false;
    if (Date.now() - this.lastFailureAt < this.cooldownMs) return true;
    // Cooldown expired: try again, and let a success clear the state so the
    // next failure is reported rather than staying silent.
    this.lastFailureAt = 0;
    this.outageReported = false;
    return false;
  }
}
