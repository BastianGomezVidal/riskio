import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';

function makeRepository() {
  return {
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    upsert: vi.fn(),
  } as unknown as Repository<Storm>;
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
  let repo: ReturnType<typeof makeRepository>;
  let service: StormsService;

  beforeEach(() => {
    repo = makeRepository();
    service = new StormsService(repo);
  });

  describe('findAll', () => {
    it('returns a paginated result ordered by most recently seen', async () => {
      const storms = [makeStorm(), makeStorm({ atcfId: 'EP122026', name: 'Lowell' })];
      repo.findAndCount.mockResolvedValue([storms, 5]);

      const result = await service.findAll(page);

      expect(repo.findAndCount).toHaveBeenCalledWith(
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
      repo.findAndCount.mockResolvedValue([[makeStorm()], 25]);
      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.meta.pageCount).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a storm with advisories loaded', async () => {
      const storm = makeStorm({ advisories: [{ id: 'adv-1' } as never] });
      repo.findOne.mockResolvedValue(storm);

      const result = await service.findOne('EP142026');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { atcfId: 'EP142026' },
        relations: { advisories: true },
      });
      expect(result.advisories.length).toBe(1);
    });

    it('throws NotFoundException for an unknown storm', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('NOPE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertFromIngestion', () => {
    it('upserts the storm and returns the persisted row', async () => {
      const persisted = makeStorm({ name: 'Fourteen-E' });
      repo.upsert.mockResolvedValue({ identifiers: ['EP142026'] });
      repo.findOneOrFail.mockResolvedValue(persisted);

      const input = { atcfId: 'EP142026', name: 'Fourteen-E', basin: 'EP' };
      const result = await service.upsertFromIngestion(input);

      expect(repo.upsert).toHaveBeenCalledWith(input, {
        conflictPaths: ['atcfId'],
      });
      expect(result).toBe(persisted);
    });
  });
});