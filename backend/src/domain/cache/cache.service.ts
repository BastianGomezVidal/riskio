import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/**
 * Thin wrapper around cache-manager that:
 *  - exposes `getOrSet(key, ttl, fn)` for read-through caching;
 *  - exposes `invalidate(pattern)` to drop keys matching a glob.
 *
 * With Keyv/Redis, `invalidate` uses the underlying Keyv store's iterator.
 * With memory, it is a no-op for patterns.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async getOrSet<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const value = await fn();
    await this.cache.set(key, value, ttlMs);
    return value;
  }

  async invalidate(pattern: string): Promise<void> {
    // cache-manager v7 with Keyv: access the underlying store.
    const stores = (
      this.cache as unknown as {
        stores?: Array<{
          iterator?: (pattern: string) => AsyncIterable<[string, unknown]>;
        }>;
      }
    ).stores;

    if (!Array.isArray(stores)) return;

    for (const store of stores) {
      if (!store.iterator) continue;

      const keys: string[] = [];
      for await (const [key] of store.iterator(pattern)) {
        keys.push(key);
      }

      if (keys.length > 0) {
        await Promise.all(keys.map((k) => this.cache.del(k)));
        this.logger.debug(
          `Invalidated ${keys.length} keys for pattern ${pattern}`,
        );
      }
    }
  }
}
