import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_STORE } from './cache.tokens.js';
import type { CacheStore } from '../domain/cache/cache.service.js';

/**
 * The Redis-backed implementation, which now lives only here.
 *
 * Nothing outside this process holds a Redis connection or the REDIS_URL
 * anymore. That is the point of the extraction, and it is worth being precise
 * about the value: Redis here holds derived data that Postgres can recompute,
 * so a compromised cache is an inconvenience, not a breach. The reason to
 * isolate it is that the API's blast radius should be the database and its own
 * logic, not every store the application happens to touch.
 */
@Injectable()
export class RedisCacheService implements CacheStore {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly store: KeyvLike;

  constructor(@Inject(CACHE_STORE) store: KeyvLike) {
    this.store = store;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.store.get(key);
    return (value ?? undefined) as T | undefined;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.store.set(key, value, Number(ttlMs));
  }

  async del(key: string): Promise<void> {
    // `delete`, not `del`. Keyv's method is named after the Map API, and
    // guessing wrong here is a runtime TypeError rather than a compile error,
    // because this is reached through a hand-written interface.
    await this.store.delete(key);
  }

  /**
   * Glob invalidation over the Keyv iterator, same as before the extraction.
   *
   * It stays a glob rather than becoming a key version: call sites invalidate
   * `storms:*` and `dashboard:*` after an ingestion run without knowing which
   * exact keys were written, and a version counter would need every read path
   * to carry the version, which is a much larger change for the same result.
   *
   * The glob is matched here, by hand, and that is the whole subtlety of this
   * method. Keyv's `iterator` takes a pattern and then ignores it: it yields
   * every key in the store. The previous implementation went one level deeper,
   * to cache-manager's adapter, where `iterator` yields nothing at all. So the
   * two options this method could be written with both fail, quietly and in
   * opposite directions — the old one dropped no keys and looked fine, and
   * trusting the instance's pattern wiped the entire cache on every ingestion
   * run. Neither raised an error; both were wrong.
   *
   * Matching it here also keeps the fake in the spec honest, because the fake
   * has to behave like the real one.
   */
  async invalidate(pattern: string): Promise<number> {
    const matcher = globToRegExp(pattern);
    const keys: string[] = [];
    for await (const [key] of this.store.iterator(pattern)) {
      if (matcher.test(key)) keys.push(key);
    }

    if (keys.length === 0) return 0;

    await Promise.all(keys.map((key) => this.store.delete(key)));
    this.logger.debug(`Invalidated ${keys.length} keys for pattern ${pattern}`);
    return keys.length;
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.store.get('__health__');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Glob to regular expression, for the cache key patterns: `storms:*`, and
 * anything else with `*` as the only metacharacter.
 *
 * Everything else is escaped, so a key containing `.` or `+` cannot turn into a
 * pattern that matches something it should not. `*` is the only wildcard these
 * call sites use and the only one supported, on purpose: a full glob
 * implementation is a lot of surface for names that are all of the form
 * `prefix:*`.
 */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}

/**
 * The slice of Keyv this service actually uses, written down after reading the
 * real object's methods rather than from memory: get, set, delete and an
 * iterator that takes a pattern. Naming these wrong compiles fine and fails at
 * runtime, which is how `del` and `store.iterator` both got in.
 */
export interface KeyvLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlMs?: number): Promise<unknown>;
  /** Named after Map.delete, which is what Keyv calls it. */
  delete(key: string): Promise<unknown>;
  /**
   * Yields the stored keys matching a glob. Present on the Keyv instance, not
   * on the adapter.
   */
  iterator(pattern: string): AsyncIterable<[string, unknown]>;
}
