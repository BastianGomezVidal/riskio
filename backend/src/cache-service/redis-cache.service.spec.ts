import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisCacheService, type KeyvLike } from './redis-cache.service.js';

/**
 * A stand-in for Keyv shaped like the real one.
 *
 * Shaped deliberately, because getting this interface wrong is invisible until
 * runtime: this file originally declared `del` and called `iterator` on the
 * adapter, and both compiled. The real object has `delete`, and its `iterator`
 * takes the pattern — the adapter's accepts one and yields nothing at all.
 *
 * So the fake below has `delete` and no `del`, and its `iterator` is the one
 * that filters. A fake that invented a `del` would have kept both bugs alive.
 */
function makeStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const store = {
    get: vi.fn(async (key: string) => data.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
    delete: vi.fn(async (key: string) => data.delete(key)),
    // Yields everything, and ignores the pattern — which is what the real
    // Keyv does. Verified against it: with keys aaa:1, bbb:2, ccc:3 stored,
    // `iterator('aaa:*')` returns all three. A fake that filtered would make
    // the test pass while the real invalidation wiped the whole cache.
    iterator: vi.fn(async function* (_pattern: string) {
      for (const [key, value] of data) {
        yield [key, value] as [string, unknown];
      }
    }),
    __data: data,
  };
  return store satisfies KeyvLike & { __data: Map<string, unknown> };
}

describe('RedisCacheService', () => {
  let store: ReturnType<typeof makeStore>;
  let service: RedisCacheService;

  beforeEach(() => {
    store = makeStore();
    service = new RedisCacheService(store);
  });

  it('returns undefined for a key that is not there', async () => {
    await expect(service.get('nope')).resolves.toBeUndefined();
  });

  it('round-trips a value', async () => {
    await service.set('k', { n: 1 }, 30_000);
    await expect(service.get('k')).resolves.toEqual({ n: 1 });
    expect(store.set).toHaveBeenCalledWith('k', { n: 1 }, 30_000);
  });

  it('deletes through the method Keyv actually has', async () => {
    await service.set('k', 1, 30_000);
    await service.del('k');

    // The name is the assertion: there is no `del` on this object, so a wrong
    // call fails here rather than in production.
    expect(store.delete).toHaveBeenCalledWith('k');
    await expect(service.get('k')).resolves.toBeUndefined();
  });

  it('drops only the keys matching a glob, not the whole store', async () => {
    // The assertion that matters most in this file. The store ignores the
    // pattern, so if the service trusted it, one `storms:*` invalidation would
    // empty every cache in the instance.
    store.__data.set('storms:1', 1);
    store.__data.set('storms:2', 2);
    store.__data.set('dashboard:summary', 3);
    store.__data.set('advisories:7', 4);

    await expect(service.invalidate('storms:*')).resolves.toBe(2);

    await expect(service.get('dashboard:summary')).resolves.toBe(3);
    await expect(service.get('advisories:7')).resolves.toBe(4);
  });

  it('escapes glob metacharacters in the key, so they match literally', async () => {
    store.__data.set('a.b:1', 1);
    store.__data.set('axb:1', 2);

    // Without escaping, `a.b:1` as a pattern would also match `axb:1`.
    await expect(service.invalidate('a.b:*')).resolves.toBe(1);
    await expect(service.get('axb:1')).resolves.toBe(2);
  });

  it('drops every key matching a glob and reports how many', async () => {
    store.__data.set('storms:1', 1);
    store.__data.set('storms:2', 2);
    store.__data.set('dashboard:summary', 3);

    await expect(service.invalidate('storms:*')).resolves.toBe(2);

    await expect(service.get('storms:1')).resolves.toBeUndefined();
    await expect(service.get('storms:2')).resolves.toBeUndefined();
    // The pattern is a boundary, not a substring: an unrelated key survives.
    await expect(service.get('dashboard:summary')).resolves.toBe(3);
  });

  it('reports zero rather than failing when a glob matches nothing', async () => {
    await expect(service.invalidate('nothing:*')).resolves.toBe(0);
  });

  it('uses the iterator on the store itself, not on a nested adapter', async () => {
    await service.invalidate('anything:*');
    // The old code reached for cache-manager's `stores[i].iterator`, which
    // accepts a pattern and yields nothing. Ingestion has been calling this
    // after every run and the caches were never dropped.
    expect(typeof store.iterator).toBe('function');
    expect((store as unknown as Record<string, unknown>).del).toBeUndefined();
  });

  it('reports reachability honestly', async () => {
    await expect(service.isReachable()).resolves.toBe(true);

    const broken = {
      ...store,
      get: async () => {
        throw new Error('down');
      },
    };
    const down = new RedisCacheService(broken);
    await expect(down.isReachable()).resolves.toBe(false);
  });
});
