import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';

function makeRepository() {
  const findAndCount = vi.fn();
  const findOne = vi.fn();
  const findOneOrFail = vi.fn();
  const upsert = vi.fn();
  const repo = {
    findAndCount,
    findOne,
    findOneOrFail,
    upsert,
  } as unknown as Repository<Storm>;
  return { repo, findAndCount, findOne, findOneOrFail, upsert };
}

function makeStorm(overrides: Partial<Storm> = {}): Storm {
  return {
    atcfId: 'EP142026',
    name: null,
    basin: 'EP',
    firstSeenAt: new Date('2026-09-10T00:00:00Z'),
    lastSeenAt: new Date('2026-09-10T01:00:00Z'),
    advisories: [],
    ...overrides,
  };
}

const page = { page: 1, limit: 20 };

describe('StormsService', () => {
  let repo: Repository<Storm>;
  let service: StormsService;
  let findAndCount: ReturnType<typeof vi.fn>;
  let findOne: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mocks = makeRepository();
    repo = mocks.repo;
    findAndCount = mocks.findAndCount;
    findOne = mocks.findOne;
    findOneOrFail = mocks.findOneOrFail;
    upsert = mocks.upsert;
    service = new StormsService(repo);
  });

  describe('findAll', () => {
    it('returns a paginated result ordered by most recently seen', async () => {
      const storms = [
        makeStorm(),
        makeStorm({ atcfId: 'EP122026', name: 'Lowell' }),
      ];
      findAndCount.mockResolvedValue([storms, 5]);

      const result = await service.findAll(page);

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { lastSeenAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toEqual(storms);
      expect(result.meta).toEqual({
        total: 5,
        page: 1,
        limit: 20,
        pageCount: 1,
        hasNextPage: false,
      });
    });

    it('computes page count and hasNextPage correctly', async () => {
      findAndCount.mockResolvedValue([[makeStorm()], 25]);
      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.meta.pageCount).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a storm with advisories loaded', async () => {
      const storm = makeStorm({ advisories: [{ id: 'adv-1' } as never] });
      findOne.mockResolvedValue(storm);

      const result = await service.findOne('EP142026');

      expect(findOne).toHaveBeenCalledWith({
        where: { atcfId: 'EP142026' },
        relations: { advisories: true },
      });
      expect(result.advisories.length).toBe(1);
    });

    it('throws NotFoundException for an unknown storm', async () => {
      findOne.mockResolvedValue(null);
      await expect(service.findOne('NOPE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertFromIngestion', () => {
    it('upserts the storm and returns the persisted row', async () => {
      const persisted = makeStorm({ name: 'Fourteen-E' });
      upsert.mockResolvedValue({ identifiers: ['EP142026'] });
      findOneOrFail.mockResolvedValue(persisted);

      const input = { atcfId: 'EP142026', name: 'Fourteen-E', basin: 'EP' };
      const result = await service.upsertFromIngestion(input);

      expect(upsert).toHaveBeenCalledWith(input, {
        conflictPaths: ['atcfId'],
      });
      expect(result).toBe(persisted);
    });
  });
});
