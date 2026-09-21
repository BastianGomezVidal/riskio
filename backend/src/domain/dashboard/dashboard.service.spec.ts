import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { Advisory } from '../weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../weather/advisories/entities/forecast-point.entity.js';
import { AdvisoriesService } from '../weather/advisories/advisories.service.js';

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
  let stormsFind: ReturnType<typeof vi.fn>;
  let findLatestPerStorm: ReturnType<typeof vi.fn>;
  let service: DashboardService;

  beforeEach(() => {
    stormsFind = vi.fn();
    findLatestPerStorm = vi.fn();

    const stormsRepo = {
      find: stormsFind,
    } as unknown as Repository<Storm>;

    const advisoriesService = {
      findLatestPerStorm,
    } as unknown as AdvisoriesService;

    service = new DashboardService(stormsRepo, advisoriesService);
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
    });
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(findLatestPerStorm).not.toHaveBeenCalled();
  });

  it('queries only active storms, most recently seen in feed first', async () => {
    stormsFind.mockResolvedValue([makeStorm()]);
    findLatestPerStorm.mockResolvedValue([]);

    await service.getSummary();

    expect(stormsFind).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { lastSeenInFeedAt: 'DESC' },
      take: 100,
    });
  });

  it('delegates latest-per-storm lookup to the advisories service', async () => {
    const storm = makeStorm();
    stormsFind.mockResolvedValue([storm]);
    findLatestPerStorm.mockResolvedValue([]);

    await service.getSummary();

    expect(findLatestPerStorm).toHaveBeenCalledWith(['EP142026']);
  });

  it('maps each storm to its latest advisory and forecast points', async () => {
    const storm = makeStorm();
    const advisory = makeAdvisory(storm, {
      id: 'adv-9',
      forecastPoints: [makePoint(), makePoint({ id: 'pt-2' })],
    });

    stormsFind.mockResolvedValue([storm]);
    findLatestPerStorm.mockResolvedValue([advisory]);

    const result = await service.getSummary();

    expect(result.storms).toHaveLength(1);
    expect(result.storms[0].latestAdvisory).toEqual({
      id: 'adv-9',
      advisoryNumber: 2,
      issuedAt: advisory.issuedAt.toISOString(),
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
