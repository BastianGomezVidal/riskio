/**
 * Cache contracts.
 *
 * Two interfaces, because there are two sides and they need different things.
 *
 * `CacheStore` is the wire contract: four operations, no read-through. The
 * original contract had `getOrSet(key, ttl, fn)`, which runs the loader — and a
 * loader is code, so it can only ever run in the caller's process. A cache
 * behind a network hop owns storage, not policy: it cannot decide what is worth
 * caching, and it should not try to.
 *
 * `CacheService` is what the rest of the application depends on: the wire
 * operations plus the read-through convenience, kept as a method because the
 * loader is a function and functions cannot be sent over a socket.
 *
 * Splitting them is what keeps callers testable. They depend on the interface,
 * so a test can pass a plain object; a class with private fields could not be
 * satisfied by one.
 */
export interface CacheStore {
  /** Stored value, or undefined when the key is absent. */
  get<T>(key: string): Promise<T | undefined>;

  set<T>(key: string, value: T, ttlMs: number): Promise<void>;

  /** Drop one key. Succeeds if it was not there. */
  del(key: string): Promise<void>;

  /**
   * Drop every key matching a glob, e.g. `storms:*`, and return how many went.
   *
   * The count is worth having: an ingestion run that invalidates `storms:*` and
   * reports zero keys is telling you the cache names have drifted, which is a
   * bug worth seeing rather than a shrug.
   */
  invalidate(pattern: string): Promise<number>;
}

export interface CacheService extends CacheStore {
  /** Read through, composing the loader with get and set. */
  getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T>;
}
