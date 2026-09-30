import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';
import { CacheService } from '../../cache/cache.service.js';
import { StormTab, StormSort } from './utils/storm-enums.js';

/**
 * Creates a minimal valid Storm entity for storms service tests.
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

describe('StormsService', () => {
  let find: ReturnType<typeof vi.fn>;
  let findAndCount: ReturnType<typeof vi.fn>;
  let findOne: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let managerUpdate: ReturnType<typeof vi.fn>;
  let managerUpsert: ReturnType<typeof vi.fn>;
  let createQueryBuilder: ReturnType<typeof vi.fn>;
  let getRawOne: ReturnType<typeof vi.fn>;
  let getRawMany: ReturnType<typeof vi.fn>;
  let andWhere: ReturnType<typeof vi.fn>;
  let orderBy: ReturnType<typeof vi.fn>;
  let getOrSet: ReturnType<typeof vi.fn>;
  let service: StormsService;

  beforeEach(() => {
    find = vi.fn();
    findAndCount = vi.fn();
    findOne = vi.fn();
    findOneOrFail = vi.fn();
    upsert = vi.fn();
    managerUpdate = vi.fn();
    managerUpsert = vi.fn();
    getRawOne = vi.fn();
    getRawMany = vi.fn();
    andWhere = vi.fn();
    orderBy = vi.fn();
    createQueryBuilder = vi.fn();
    // StormsService caches findMany behind CacheService; the stub below always
    // calls through, so these tests exercise the real computation.
    getOrSet = vi.fn(
      async (_key: string, _ttlMs: number, fn: () => Promise<unknown>) => fn(),
    );

    const manager = {
      update: managerUpdate,
      upsert: managerUpsert,
    };

    const qb = {
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      // The captured mocks, not fresh `vi.fn()`s. Two names for one function is
      // how a test ends up asserting `0 calls` on a query builder the service
      // demonstrably called.
      andWhere,
      groupBy: vi.fn().mockReturnThis(),
      orderBy,
      getRawOne,
      getRawMany,
    };
    createQueryBuilder.mockReturnValue(qb);

    const repository = {
      find,
      findAndCount,
      findOne,
      findOneOrFail,
      upsert,
      createQueryBuilder,
      manager: {
        transaction: (callback: (m: unknown) => Promise<void>) =>
          callback(manager),
      },
    } as unknown as Repository<Storm>;

    service = new StormsService(repository, {
      getOrSet,
    } as unknown as CacheService);
  });

  /*
   * findMany is the storm list the whole app reads from, and it was the one
   * public method here with no test at all: the file only covered findOne. It is
   * also where the filter logic lives, and that logic is easy to get subtly
   * wrong in a way a type checker cannot see — a `q` that never reaches the
   * query, a `cat` filter that silently drops every category because of a
   * string that looked like it worked, an inactive storm showing up on the
   * "active" tab.
   *
   * `getRawMany` is a mock, so what is asserted here is the query the service
   * builds, not the SQL's result. That is the part with the logic in it.
   */
  describe('findMany', () => {
    function rawRow(overrides: Record<string, unknown> = {}) {
      return {
        atcfId: 'EP142026',
        name: 'Odile',
        basin: 'EP',
        firstSeenAt: new Date('2026-09-10T00:00:00Z'),
        lastSeenAt: new Date('2026-09-10T01:00:00Z'),
        isActive: true,
        lastSeenInFeedAt: new Date('2026-09-10T01:00:00Z'),
        advisoryCount: '3',
        latestAdvisoryNumber: '2',
        latestAdvisoryIssuedAt: new Date('2026-09-10T02:33:27Z'),
        ...overrides,
      };
    }

    it('scopes the active tab to active storms and reads through the cache', async () => {
      getRawMany.mockResolvedValue([rawRow()]);

      const result = await service.findMany({ tab: StormTab.Active });

      expect(andWhere).toHaveBeenCalledWith('s.isActive = :isActive', {
        isActive: true,
      });

      expect(getOrSet).toHaveBeenCalledTimes(1);
      const [cacheKey, ttlMs] = getOrSet.mock.calls[0];
      /*
       * Eight segments: 'storms' plus tab, q, sort, basin, cat, yearFrom and
       * yearTo, all empty but the tab. The key is a positional join, so the
       * segment count is load-bearing: a new filter added without a slot would
       * let `basin=ep` collide with `cat=ep` and serve one for the other.
       */
      expect(cacheKey).toBe('storms:active::::::');
      expect(cacheKey.split(':')).toHaveLength(8);
      expect(ttlMs).toBe(60_000);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ atcfId: 'EP142026', name: 'Odile' });
    });

    it('does not filter on isActive for the past tab', async () => {
      getRawMany.mockResolvedValue([rawRow({ isActive: false })]);

      await service.findMany({ tab: StormTab.Past });

      expect(andWhere).toHaveBeenCalledWith('s.isActive = :isActive', {
        isActive: false,
      });
    });

    it('lowercases the free-text filter and matches name or id', async () => {
      getRawMany.mockResolvedValue([]);

      await service.findMany({
        tab: StormTab.Active,
        q: 'ODILE',
      });

      expect(andWhere).toHaveBeenCalledWith(
        '(LOWER(s.name) LIKE :q OR LOWER(s.atcfId) LIKE :q)',
        { q: '%odile%' },
      );
    });

    it('splits and uppercases a basin list', async () => {
      getRawMany.mockResolvedValue([]);

      await service.findMany({
        tab: StormTab.Active,
        basin: 'ep, cp',
      });

      expect(andWhere).toHaveBeenCalledWith('s.basin IN (:...basins)', {
        basins: ['EP', 'CP'],
      });
    });

    it('maps the ts shorthand to category 0', async () => {
      getRawMany.mockResolvedValue([]);

      await service.findMany({
        tab: StormTab.Active,
        cat: 'ts,3',
      });

      expect(andWhere).toHaveBeenCalledWith(
        expect.stringContaining('IN (:...cats)'),
        { cats: [0, 3] },
      );
    });

    it('skips the category filter when no value survives validation', async () => {
      getRawMany.mockResolvedValue([]);

      await service.findMany({
        tab: StormTab.Active,
        cat: 'not-a-number',
      });

      expect(andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('IN (:...cats)'),
        expect.anything(),
      );
    });

    it('applies both year bounds when given', async () => {
      getRawMany.mockResolvedValue([]);

      await service.findMany({
        tab: StormTab.Active,
        yearFrom: 2020,
        yearTo: 2026,
      });

      expect(andWhere).toHaveBeenCalledWith(
        'EXTRACT(YEAR FROM s."firstSeenAt") >= :yearFrom',
        { yearFrom: 2020 },
      );
      expect(andWhere).toHaveBeenCalledWith(
        'EXTRACT(YEAR FROM s."firstSeenAt") <= :yearTo',
        { yearTo: 2026 },
      );
    });

    it('orders by the requested sort, defaulting to newest', async () => {
      getRawMany.mockResolvedValue([]);

      await service.findMany({ tab: StormTab.Active });
      expect(orderBy).toHaveBeenCalledWith(
        's.lastSeenInFeedAt',
        'DESC',
        'NULLS LAST',
      );

      orderBy.mockClear();
      await service.findMany({
        tab: StormTab.Active,
        sort: StormSort.NameAsc,
      });
      expect(orderBy).toHaveBeenCalledWith('s.name', 'ASC', 'NULLS LAST');

      orderBy.mockClear();
      await service.findMany({
        tab: StormTab.Active,
        sort: StormSort.Oldest,
      });
      expect(orderBy).toHaveBeenCalledWith(
        's.lastSeenInFeedAt',
        'ASC',
        'NULLS LAST',
      );
    });

    it('converts the advisory count from a string, as Postgres returns it', async () => {
      getRawMany.mockResolvedValue([rawRow({ advisoryCount: '7' })]);

      const [storm] = await service.findMany({ tab: StormTab.Active });

      expect(storm.advisoryCount).toBe(7);
      expect(typeof storm.advisoryCount).toBe('number');
    });

    it('tolerates a storm with no advisories at all', async () => {
      getRawMany.mockResolvedValue([
        rawRow({
          advisoryCount: '0',
          latestAdvisoryNumber: null,
          latestAdvisoryIssuedAt: null,
        }),
      ]);

      const [storm] = await service.findMany({ tab: StormTab.Active });

      expect(storm.advisoryCount).toBe(0);
      expect(storm.latestAdvisoryNumber).toBeNull();
    });
  });

  describe('findOne', () => {
    it('loads the storm together with its advisories relation', async () => {
      const storm = makeStorm();
      findOne.mockResolvedValue(storm);
      getRawOne.mockResolvedValue({
        advisoryCount: '3',
        latestAdvisoryNumber: '22',
        latestAdvisoryIssuedAt: new Date('2026-09-10T01:00:00Z'),
      });

      const result = await service.findOne('EP142026');

      expect(findOne).toHaveBeenCalledWith({
        where: { atcfId: 'EP142026' },
        relations: { advisories: true },
        select: {
          atcfId: true,
          name: true,
          basin: true,
          firstSeenAt: true,
          lastSeenAt: true,
          isActive: true,
          lastSeenInFeedAt: true,
          advisories: {
            id: true,
            advisoryNumber: true,
            issuedAt: true,
          },
        },
        order: { advisories: { advisoryNumber: 'DESC' } },
      });

      expect(createQueryBuilder).toHaveBeenCalledWith('s');

      expect(result).toEqual({
        atcfId: 'EP142026',
        name: 'Odile',
        basin: 'EP',
        firstSeenAt: storm.firstSeenAt,
        lastSeenAt: storm.lastSeenAt,
        isActive: true,
        lastSeenInFeedAt: storm.lastSeenInFeedAt,
        advisoryCount: 3,
        latestAdvisoryNumber: 22,
        latestAdvisoryIssuedAt: new Date('2026-09-10T01:00:00Z'),
        advisories: [],
      });
    });

    it('throws NotFoundException for an unknown atcfId', async () => {
      findOne.mockResolvedValue(null);
      getRawOne.mockResolvedValue(null);

      await expect(service.findOne('ZZ999999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
