import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service.js';
import { WeatherClientService } from './weather-client.service.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { Advisory } from '../weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../weather/advisories/entities/forecast-point.entity.js';
import { AdvisoriesService } from '../weather/advisories/advisories.service.js';
import { CacheService } from '../cache/cache.service.js';

/**
 * Creates a minimal valid Storm entity for dashboard summary tests.
 */
function makeStorm(overrides: Partial<Storm> = {}): Storm {
  return {
    atcfId: 'EP142026',
    name: 'Odile',
    basin: 'EP',
    firstSeenAt: new Date('2026-09-10T00:00:00Z'),
    lastSeenAt: new Date('2026-09-10T01:00:00Z'),
    isActive: true,
    lastSeenInFeedAt: new Date('2026-09-10T01:00:00Z'),
    advisories: [],
    ...overrides,
  };
}

/**
 * Creates a minimal ForecastPoint entity.
 */
function makePoint(overrides: Partial<ForecastPoint> = {}): ForecastPoint {
  return {
    id: 'pt-1',
    validAt: new Date('2026-09-10T12:00:00Z'),
    latitude: 16.7,
    longitude: -118.5,
    windSpeedKt: 35,
    pressureMb: null,
    category: 0,
    advisory: null as never,
    ...overrides,
  };
}

/**
 * Creates a minimal Advisory carrying its storm relation and forecast points.
 */
function makeAdvisory(
  storm: Storm,
  overrides: Partial<Advisory> = {},
): Advisory {
  return {
    id: 'adv-1',
    advisoryNumber: 2,
    issuedAt: new Date('2026-09-10T02:33:27Z'),
    rawText: 'TCM advisory',
    ingestedAt: new Date('2026-09-10T02:34:00Z'),
    storm,
    forecastPoints: [],
    track: null,
    cone: null,
    warnings: [],
    ...overrides,
  };
}

describe('DashboardService', () => {
  // Typed with a call signature so they can be invoked. The bare
  // ReturnType<typeof vi.fn> is Mock<Procedure | Constructable>, which TS
  // refuses to call, and that is a type looseness unrelated to what is tested.
  let stormsFind: Mock<() => Promise<unknown>>;
  let findLatestPerStorm: Mock<(atcfIds: string[]) => Promise<unknown>>;
  let service: DashboardService;

  beforeEach(() => {
    stormsFind = vi.fn<() => Promise<unknown>>();
    findLatestPerStorm = vi.fn<(atcfIds: string[]) => Promise<unknown>>();

    // The dashboard reads through the weather service now, so the seam the
    // tests stub is a client, not a repository and a service. The repository
    // shape disappeared when the read moved over the network.
    const weather = {
      activeStorms: () => stormsFind(),
      latestAdvisoriesPerStorm: (atcfIds: string[]) => findLatestPerStorm(atcfIds),
    } as unknown as WeatherClientService;

    // getSummary is served through CacheService; the stub always calls
    // through so these tests exercise the real computation.
    const cache = {
      getOrSet: async (_key: string, _ttlMs: number, fn: () => Promise<unknown>) =>
        fn(),
    } as unknown as CacheService;

    service = new DashboardService(weather, cache);
  });

  it('returns an empty summary when no storms exist', async () => {
    stormsFind.mockResolvedValue([]);

    const result = await service.getSummary();

    expect(result.storms).toEqual([]);
    expect(result.totals).toEqual({
        events: 0,
        named: 0,
        hurricanes: 0,
        ace: 0,
        pacific: 0,
        atlantic: 0,
    });
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(findLatestPerStorm).not.toHaveBeenCalled();
  });

  /**
   * The active-storms query no longer lives here. It moved to the weather
   * service together with the domain, so what is left to assert is that the
   * dashboard asks for it exactly once and takes the answer as given — the
   * ordering and the limit are now the weather service's business, and a test
   * here asserting them would be asserting someone else's implementation.
   */
  it('asks the weather service for the active storms', async () => {
    stormsFind.mockResolvedValue([makeStorm()]);
    findLatestPerStorm.mockResolvedValue([]);

    await service.getSummary();

    expect(stormsFind).toHaveBeenCalledTimes(1);
  });

  it('asks for the latest advisories of exactly those storms', async () => {
    const storm = makeStorm();
    stormsFind.mockResolvedValue([storm]);
    findLatestPerStorm.mockResolvedValue([]);

    await service.getSummary();

    expect(findLatestPerStorm).toHaveBeenCalledWith(['EP142026']);
  });

  it('does not ask for advisories when there are no storms', async () => {
    // An empty storm list means an empty atcfId list, and the client turns
    // that into a no-op rather than a request with an empty query string.
    stormsFind.mockResolvedValue([]);
    findLatestPerStorm.mockResolvedValue([]);

    await service.getSummary();

    expect(findLatestPerStorm).not.toHaveBeenCalled();
  });

  it('maps each storm to its latest advisory and forecast points', async () => {
    const storm = makeStorm();
    /**
     * issuedAt as an ISO string, which is what the weather service actually
     * returns: JSON has no Date. A fixture with a real Date here would let the
     * test pass while the service was quietly relying on a shape the network
     * never delivers.
     */
    const advisory = {
      ...makeAdvisory(storm, {
        id: 'adv-9',
        forecastPoints: [makePoint(), makePoint({ id: 'pt-2' })],
      }),
      issuedAt: new Date('2026-09-10T02:33:27Z').toISOString(),
    };

    stormsFind.mockResolvedValue([storm]);
    findLatestPerStorm.mockResolvedValue([advisory]);

    const result = await service.getSummary();

    expect(result.storms).toHaveLength(1);
    expect(result.storms[0].latestAdvisory).toEqual({
      id: 'adv-9',
      advisoryNumber: 2,
      issuedAt: advisory.issuedAt,
      forecastPoints: advisory.forecastPoints,
    });
  });

  it('keys advisories by storm regardless of lookup order', async () => {
    const stormA = makeStorm({ atcfId: 'EP142026', name: 'Odile' });
    const stormB = makeStorm({ atcfId: 'AL052026', name: null });

    stormsFind.mockResolvedValue([stormA, stormB]);

    findLatestPerStorm.mockResolvedValue([
      makeAdvisory(stormB, { id: 'adv-b', advisoryNumber: 9 }),
      makeAdvisory(stormA, { id: 'adv-a', advisoryNumber: 3 }),
    ]);

    const result = await service.getSummary();

    const byId = new Map(
      result.storms.map((s) => [s.storm.atcfId, s.latestAdvisory]),
    );

    expect(byId.get('EP142026')?.id).toBe('adv-a');
    expect(byId.get('AL052026')?.id).toBe('adv-b');
  });

  it('leaves latestAdvisory null for storms without one', async () => {
      const storm = makeStorm({ atcfId: 'CP062026', name: null });
      stormsFind.mockResolvedValue([storm]);
      findLatestPerStorm.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.storms[0].latestAdvisory).toBeNull();
      expect(result.totals).toEqual({
        events: 1,
        named: 0,
        hurricanes: 0,
        ace: 0,
        pacific: 1,
        atlantic: 0,
  });
  });

  it('counts named storms using a non-null name', async () => {
      const named = makeStorm({ atcfId: 'EP142026', name: 'Odile' });
      const unnamed = makeStorm({ atcfId: 'AL052026', name: null });

      stormsFind.mockResolvedValue([named, unnamed]);
      findLatestPerStorm.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.totals.named).toBe(1);
  });

  it('counts hurricanes when the latest advisory has a category >= 1 point', async () => {
      const storm = makeStorm();
      const advisory = makeAdvisory(storm, {
        forecastPoints: [makePoint({ category: 2 })],
      });

      stormsFind.mockResolvedValue([storm]);
      findLatestPerStorm.mockResolvedValue([advisory]);

      const result = await service.getSummary();

      expect(result.totals.hurricanes).toBe(1);
  });

  it('does not count a storm as hurricane without category >= 1', async () => {
      const storm = makeStorm();
      const advisory = makeAdvisory(storm, {
        forecastPoints: [makePoint({ category: 0 })],
      });

      stormsFind.mockResolvedValue([storm]);
      findLatestPerStorm.mockResolvedValue([advisory]);

      const result = await service.getSummary();

      expect(result.totals.hurricanes).toBe(0);
  });

  it('accumulates ACE from tropical-storm-strength wind points', async () => {
      const storm = makeStorm();
      const advisory = makeAdvisory(storm, {
        forecastPoints: [
          makePoint({ windSpeedKt: 34 }),
          makePoint({ windSpeedKt: 50 }),
          makePoint({ windSpeedKt: 33 }),
        ],
      });

      stormsFind.mockResolvedValue([storm]);
      findLatestPerStorm.mockResolvedValue([advisory]);

      const result = await service.getSummary();

      // (34² + 50²) / 10_000 = 0.3656 → rounded to 1 decimal.
      expect(result.totals.ace).toBe(0.4);
  });

  it('only scores ACE from the latest advisory of each storm', async () => {
      const stormA = makeStorm({ atcfId: 'EP142026' });
      const stormB = makeStorm({ atcfId: 'AL052026' });

      stormsFind.mockResolvedValue([stormA, stormB]);

      findLatestPerStorm.mockResolvedValue([
        makeAdvisory(stormA, {
          forecastPoints: [makePoint({ windSpeedKt: 100 })],
        }),
        makeAdvisory(stormB, {
          forecastPoints: [makePoint({ windSpeedKt: 20 })],
        }),
      ]);

      const result = await service.getSummary();

      // Only storm A contributes: 100² / 10_000 = 1.0.
      expect(result.totals.ace).toBe(1);
  });

  it('handles advisories without forecast points', async () => {
      const storm = makeStorm();
      const advisory = makeAdvisory(storm);

      stormsFind.mockResolvedValue([storm]);
      findLatestPerStorm.mockResolvedValue([advisory]);

      const result = await service.getSummary();

      expect(result.storms[0].latestAdvisory?.forecastPoints).toEqual([]);
      expect(result.totals).toEqual({
        events: 1,
        named: 1,
        hurricanes: 0,
        ace: 0,
        pacific: 1,
        atlantic: 0,
  });
  });

  it('propagates storm repository errors', async () => {
      const error = new Error('database unavailable');
      stormsFind.mockRejectedValue(error);

      await expect(service.getSummary()).rejects.toBe(error);
  });

  it('propagates advisories service errors', async () => {
      const error = new Error('lookup failed');

      stormsFind.mockResolvedValue([makeStorm()]);
      findLatestPerStorm.mockRejectedValue(error);

      await expect(service.getSummary()).rejects.toBe(error);
  });
});
