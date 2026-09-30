import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardHealthController } from './dashboard-health.controller.js';
import type { CacheService } from '../domain/cache/cache.service.js';

/**
 * This check reported `cache: unreachable` against a cache that was up.
 *
 * It read a `__health__` key that nothing ever writes, so a cache miss and a
 * cache outage produced the same answer, and the key was a miss by definition.
 * These tests are the regression: a miss from a healthy cache is no longer
 * reported as an outage, and a real outage is still reported as one.
 */
describe('DashboardHealthController', () => {
  let cache: CacheService;
  let store: Map<string, unknown>;
  let controller: DashboardHealthController;
  // Held separately so the assertions read `expect(setMock)` rather than
  // `expect(cache.set)`, which is an unbound-method reference to a method on an
  // interface and not a spy.
  let setMock: ReturnType<typeof vi.fn>;
  let getMock: ReturnType<typeof vi.fn>;
  let delMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map<string, unknown>();
    // A working cache, so the only variable in each test is the behaviour under
    // test. get() returns undefined for an absent key, exactly as the real one.
    setMock = vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    });
    getMock = vi.fn(async (key: string) => store.get(key));
    delMock = vi.fn(async (key: string) => {
      store.delete(key);
    });

    cache = {
      get: getMock,
      set: setMock,
      del: delMock,
      invalidate: vi.fn(async () => 0),
      getOrSet: vi.fn(),
    } as never;

    controller = new DashboardHealthController(cache);
  });

  it('reports a healthy cache as reachable', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      cache: 'reachable',
    });
  });

  it('writes before reading, so the answer comes from a real round trip', async () => {
    await controller.check();

    expect(setMock).toHaveBeenCalledOnce();
    expect(getMock).toHaveBeenCalledOnce();
    expect(getMock.mock.calls[0][0]).toBe(setMock.mock.calls[0][0]);
  });

  it('cleans up the probe key instead of leaving it to expire', async () => {
    await controller.check();

    const writtenKey = setMock.mock.calls[0][0];
    expect(delMock).toHaveBeenCalledWith(writtenKey);
    expect(store.has(writtenKey)).toBe(false);
  });

  it('gives each process its own probe key, so two replicas cannot collide', async () => {
    await controller.check();
    const first = setMock.mock.calls[0][0];

    setMock.mockClear();
    await controller.check();
    const second = setMock.mock.calls[0][0];

    // Same process, same key: that is the point, the value is per-process so
    // one replica's cleanup cannot delete another's probe mid-flight.
    expect(second).toBe(first);
    expect(first).toContain(String(process.pid));
  });

  describe('when the cache is down', () => {
    beforeEach(() => {
      // The HttpCacheService contract: fail open, resolve to the empty answer,
      // never throw. That is what made a missing key look like an outage.
      const unreachable: CacheService = {
        ...cache,
        get: async () => undefined,
        set: async () => {
          throw new Error('cache unreachable');
        },
        del: async () => {},
      };
      controller = new DashboardHealthController(unreachable);
    });

    it('reports unreachable rather than claiming everything is fine', async () => {
      await expect(controller.check()).resolves.toEqual({
        status: 'ok',
        cache: 'unreachable',
      });
    });

    it('does not throw, so the container healthcheck gets a verdict', async () => {
      await expect(controller.check()).resolves.toBeDefined();
    });
  });

  it('reports unreachable when the write lands but the read comes back empty', async () => {
    // The silent failure this replaces: the store accepted the write and then
    // answered nothing, which used to be indistinguishable from an outage.
    const writeOnly: CacheService = { ...cache, get: async () => undefined };
    controller = new DashboardHealthController(writeOnly);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      cache: 'unreachable',
    });
  });
});
