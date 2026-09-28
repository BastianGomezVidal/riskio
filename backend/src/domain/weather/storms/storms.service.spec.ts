import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';
import { CacheService } from '../../cache/cache.service.js';

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
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getRawOne,
      getRawMany: vi.fn(),
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

  describe('reconcileFromFeed', () => {
    it('flips the basin inactive and upserts the feed storms in one transaction', async () => {
      managerUpdate.mockResolvedValue(undefined);
      managerUpsert.mockResolvedValue(undefined);

      await service.reconcileFromFeed('EP', [
        { atcfId: 'EP142026', name: 'Odile', basin: 'EP' },
        { atcfId: 'EP152026', name: null, basin: 'EP' },
      ]);

      expect(managerUpdate).toHaveBeenCalledWith(
        Storm,
        { basin: 'EP' },
        { isActive: false },
      );

      expect(managerUpsert).toHaveBeenCalledTimes(2);

      expect(managerUpsert).toHaveBeenNthCalledWith(
        1,
        Storm,
        {
          atcfId: 'EP142026',
          name: 'Odile',
          basin: 'EP',
          isActive: true,
          lastSeenInFeedAt: expect.any(Date),
        },
        { conflictPaths: ['atcfId'] },
      );

      expect(managerUpsert).toHaveBeenNthCalledWith(
        2,
        Storm,
        {
          atcfId: 'EP152026',
          name: null,
          basin: 'EP',
          isActive: true,
          lastSeenInFeedAt: expect.any(Date),
        },
        { conflictPaths: ['atcfId'] },
      );
    });

    it('marks every basin storm inactive when the feed is empty', async () => {
      managerUpdate.mockResolvedValue(undefined);

      await service.reconcileFromFeed('CP', []);

      expect(managerUpdate).toHaveBeenCalledWith(
        Storm,
        { basin: 'CP' },
        { isActive: false },
      );

      expect(managerUpsert).not.toHaveBeenCalled();
    });

    it('propagates transaction failures', async () => {
      const error = new Error('transaction aborted');
      managerUpdate.mockRejectedValue(error);

      await expect(service.reconcileFromFeed('EP', [])).rejects.toBe(error);
    });
  });

  describe('upsertFromIngestion', () => {
    it('stores the storm as active and returns the reloaded row', async () => {
      const storm = makeStorm();
      upsert.mockResolvedValue(undefined);
      findOneOrFail.mockResolvedValue(storm);

      await expect(
        service.upsertFromIngestion({
          atcfId: 'EP142026',
          name: 'Odile',
          basin: 'EP',
        }),
      ).resolves.toBe(storm);

      expect(upsert).toHaveBeenCalledWith(
        {
          atcfId: 'EP142026',
          name: 'Odile',
          basin: 'EP',
          isActive: true,
          lastSeenInFeedAt: expect.any(Date),
        },
        { conflictPaths: ['atcfId'] },
      );

      expect(findOneOrFail).toHaveBeenCalledWith({
        where: { atcfId: 'EP142026' },
      });
    });
  });
});
