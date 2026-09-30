import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpCacheService } from './http-cache.service.js';

/**
 * The behaviour that matters here is not the happy path. A cache is a
 * performance decision, and these tests are about the extraction not turning a
 * cache outage into an application outage: before it, `get` rejecting meant
 * `getOrSet` never reached its loader and the request failed for data that was
 * sitting in the database all along.
 */
describe('HttpCacheService', () => {
  // Strings, because that is what ConfigService returns for anything coming
  // from the environment. A mock that returns numbers hides TypeErrors that only
  // appear in a container.
  const config = {
    get: (key: string, fallback?: unknown) =>
      ({
        CACHE_SERVICE_URL: 'http://cache:3005/',
        CACHE_SERVICE_TIMEOUT_MS: '2000',
        CACHE_SERVICE_COOLDOWN_MS: '10000',
      })[key] ?? fallback,
  } as never;

  let service: HttpCacheService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = new HttpCacheService(config);
  });

  afterEach(() => vi.unstubAllGlobals());

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  it('treats a missing key as undefined, not as a stored null', async () => {
    fetchMock.mockResolvedValue(ok({ found: false, value: null }));
    await expect(service.get('storms:1')).resolves.toBeUndefined();
  });

  it('returns a cached null, which is a real cached value', async () => {
    fetchMock.mockResolvedValue(ok({ found: true, value: null }));
    await expect(service.get('empty')).resolves.toBeNull();
  });

  it('encodes keys into the path', async () => {
    fetchMock.mockResolvedValue(ok({ found: false, value: null }));
    await service.get('storms:a b:c');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://cache:3005/cache/storms%3Aa%20b%3Ac',
    );
  });

  it('runs the loader on a miss and stores the result', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ found: false, value: null }))
      .mockResolvedValueOnce(ok({ stored: true }));
    const loader = vi.fn().mockResolvedValue({ n: 7 });

    const value = await service.getOrSet('k', 30_000, loader);

    expect(value).toEqual({ n: 7 });
    expect(loader).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toEqual({ key: 'k', value: { n: 7 }, ttlMs: 30_000 });
  });

  it('does not run the loader on a hit', async () => {
    fetchMock.mockResolvedValue(ok({ found: true, value: { n: 1 } }));
    const loader = vi.fn();

    await expect(service.getOrSet('k', 30_000, loader)).resolves.toEqual({
      n: 1,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  /**
   * The whole point of failing open. An unreachable cache must produce a slow
   * response, not a 500.
   */
  it('falls through to the loader when the cache service is down', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const loader = vi.fn().mockResolvedValue('from-database');

    await expect(service.getOrSet('k', 30_000, loader)).resolves.toBe(
      'from-database',
    );
    expect(loader).toHaveBeenCalledOnce();
  });

  it('does not fail the request when the store call after the loader fails', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ found: false, value: null }))
      .mockRejectedValueOnce(new Error('ECONNRESET'));

    // The value is already computed. Losing the write costs a slow next
    // request; propagating it would throw away work that succeeded.
    await expect(
      service.getOrSet('k', 30_000, async () => 'computed'),
    ).resolves.toBe('computed');
  });

  /**
   * The one that came out of a real outage rather than out of thought. With the
   * cache service stopped, every read still waited the full timeout, and a miss
   * paid it twice: responses took 4 s against the 0.5 s the database work takes
   * uncached. Skipping the call during the cooldown is what makes failing open
   * actually mean "slower", rather than "slower than doing nothing at all".
   */
  it('stops calling a service that just failed, for the cooldown', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const loader = vi.fn().mockResolvedValue('v');

    await service.getOrSet('k', 30_000, loader);
    const callsAfterFirst = fetchMock.mock.calls.length;

    await service.getOrSet('k', 30_000, loader);
    await service.getOrSet('k', 30_000, loader);

    // Nothing more was attempted: no more timeouts to wait through.
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    // And the loader still ran both times, so the data is still correct.
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('reports the outage only once, not once per request', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const warn = vi
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);

    for (let i = 0; i < 5; i++) await service.get('k');

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('reports a failure status but still answers as a miss', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'redis down',
    });

    await expect(service.get('k')).resolves.toBeUndefined();
  });

  it('swallows a failed invalidate, because a stale entry is not worth an error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.invalidate('storms:*')).resolves.toBe(0);
  });

  it('returns the number of keys an invalidate dropped', async () => {
    fetchMock.mockResolvedValue(ok({ deleted: 4 }));
    await expect(service.invalidate('storms:*')).resolves.toBe(4);
  });

  it('coerces the timeout to a number', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockResolvedValue(ok({ found: false, value: null }));

    await service.get('k');

    expect(spy).toHaveBeenCalledWith(2000);
    spy.mockRestore();
  });
});
