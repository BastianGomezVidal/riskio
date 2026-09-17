import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';
import { PageQueryDto } from '../../../common/dto/page-query.dto.js';

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

/**
 * Builds a pagination DTO with explicit values, bypassing the HTTP layer.
 */
function makePage(page = 1, limit = 20): PageQueryDto {
  return { page, limit } as PageQueryDto;
}

describe('StormsService', () => {
  let find: ReturnType<typeof vi.fn>;
  let findAndCount: ReturnType<typeof vi.fn>;
  let findOne: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let managerUpdate: ReturnType<typeof vi.fn>;
  let managerUpsert: ReturnType<typeof vi.fn>;
  let service: StormsService;

  beforeEach(() => {
    find = vi.fn();
    findAndCount = vi.fn();
    findOne = vi.fn();
    findOneOrFail = vi.fn();
    upsert = vi.fn();
    managerUpdate = vi.fn();
    managerUpsert = vi.fn();

    const manager = {
      update: managerUpdate,
      upsert: managerUpsert,
    };

    const repository = {
      find,
      findAndCount,
      findOne,
      findOneOrFail,
      upsert,
      manager: {
        transaction: (callback: (m: unknown) => Promise<void>) =>
          callback(manager),
      },
    } as unknown as Repository<Storm>;

    service = new StormsService(repository);
  });

  describe('findActive', () => {
    it('queries active storms, newest feed appearance first', async () => {
      const storms = [makeStorm()];
      find.mockResolvedValue(storms);

      await expect(service.findActive()).resolves.toBe(storms);

      expect(find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { lastSeenInFeedAt: 'DESC' },
      });
    });
  });

  describe('findHistory', () => {
    it('paginates inactive storms and reports page metadata', async () => {
      const data = [makeStorm({ isActive: false })];
      findAndCount.mockResolvedValue([data, 45]);

      const result = await service.findHistory(makePage(1, 20));

      expect(findAndCount).toHaveBeenCalledWith({
        where: { isActive: false },
        order: { lastSeenInFeedAt: 'DESC' },
        skip: 0,
        take: 20,
      });

      expect(result.data).toBe(data);
      expect(result.meta).toEqual({
        total: 45,
        page: 1,
        limit: 20,
        pageCount: 3,
        hasNextPage: true,
      });
    });

    it('derives the offset from the requested page', async () => {
      findAndCount.mockResolvedValue([[], 45]);

      await service.findHistory(makePage(3, 10));

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('reports no next page on the last exact page', async () => {
      findAndCount.mockResolvedValue([[], 20]);

      const result = await service.findHistory(makePage(2, 10));

      expect(result.meta).toEqual({
        total: 20,
        page: 2,
        limit: 10,
        pageCount: 2,
        hasNextPage: false,
      });
    });

    it('reports zero pages when there is no history', async () => {
      findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findHistory(makePage());

      expect(result.meta.pageCount).toBe(0);
      expect(result.meta.hasNextPage).toBe(false);
    });
  });

  describe('findOne', () => {
    it('loads the storm together with its advisories relation', async () => {
      const storm = makeStorm();
      findOne.mockResolvedValue(storm);

      await expect(service.findOne('EP142026')).resolves.toBe(storm);

      expect(findOne).toHaveBeenCalledWith({
        where: { atcfId: 'EP142026' },
        relations: { advisories: true },
      });
    });

    it('throws NotFoundException for an unknown atcfId', async () => {
      findOne.mockResolvedValue(null);

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
