import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';

function makeInsertMock() {
  const chain = {
    insert: vi.fn(),
    into: vi.fn(),
    values: vi.fn(),
    orIgnore: vi.fn(),
    execute: vi.fn(),
  };
  chain.insert.mockReturnThis();
  chain.into.mockReturnThis();
  chain.values.mockReturnThis();
  chain.orIgnore.mockReturnThis();
  return chain;
}

function makeRepository() {
  const insert = makeInsertMock();
  const repo = {
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    createQueryBuilder: vi.fn(() => insert),
  } as unknown as Repository<Advisory>;
  return { repo, insert };
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

function makeAdvisory(overrides: Partial<Advisory> = {}): Advisory {
  return {
    id: 'adv-1',
    advisoryNumber: 2,
    issuedAt: new Date('2026-09-10T00:00:00Z'),
    rawText: 'TCM advisory text',
    ingestedAt: new Date('2026-09-10T00:01:00Z'),
    storm: makeStorm(),
    forecastPoints: [],
    ...overrides,
  };
}

const page = { page: 1, limit: 20 };

describe('AdvisoriesService', () => {
  let repo: Repository<Advisory>;
  let insert: ReturnType<typeof makeInsertMock>;
  let service: AdvisoriesService;

  beforeEach(() => {
    const built = makeRepository();
    repo = built.repo;
    insert = built.insert;
    service = new AdvisoriesService(repo);
  });

  describe('findByStorm', () => {
    it('returns paginated advisories for a storm, newest first', async () => {
      const advisories = [makeAdvisory(), makeAdvisory({ advisoryNumber: 1 })];
      repo.findAndCount.mockResolvedValue([advisories, 2]);

      const result = await service.findByStorm('EP142026', page);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storm: { atcfId: 'EP142026' } },
          order: { advisoryNumber: 'DESC' },
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('findOne', () => {
    it('returns a single advisory with forecast points', async () => {
      const advisory = makeAdvisory({ forecastPoints: [{ id: 'pt-1' } as never] });
      repo.findOne.mockResolvedValue(advisory);

      const result = await service.findOne('adv-1');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'adv-1' },
        relations: { forecastPoints: true },
      });
      expect(result.forecastPoints).toHaveLength(1);
    });

    it('throws NotFoundException for an unknown advisory', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertFromIngestion', () => {
    const input = {
      storm: makeStorm(),
      advisoryNumber: 2,
      issuedAt: new Date('2026-09-10T02:00:00Z'),
      rawText: 'new text',
    };

    it('reports inserted=true when the row is created', async () => {
      insert.execute.mockResolvedValue({
        identifiers: [{ id: 'adv-new' }],
        generatedMaps: [{ id: 'adv-new' }],
      });
      repo.findOneOrFail.mockResolvedValue(makeAdvisory());

      const result = await service.upsertFromIngestion(input);

      expect(insert.orIgnore).toHaveBeenCalled();
      expect(result.inserted).toBe(true);
      expect(repo.findOneOrFail).toHaveBeenCalled();
    });

    it('reports inserted=false when ON CONFLICT skips (identifiers has null)', async () => {
      // TypeORM yields [null] for a skipped ON CONFLICT DO NOTHING row
      insert.execute.mockResolvedValue({
        identifiers: [null],
        generatedMaps: [{}],
      });
      repo.findOneOrFail.mockResolvedValue(makeAdvisory());

      const result = await service.upsertFromIngestion(input);

      expect(result.inserted).toBe(false);
    });

    it('issues INSERT ... ON CONFLICT DO NOTHING', async () => {
      insert.execute.mockResolvedValue({ identifiers: [{ id: 'adv-new' }] });
      repo.findOneOrFail.mockResolvedValue(makeAdvisory());

      await service.upsertFromIngestion(input);

      expect(insert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          storm: input.storm,
          advisoryNumber: 2,
          issuedAt: input.issuedAt,
          rawText: 'new text',
        }),
      );
      expect(insert.orIgnore).toHaveBeenCalled();
      expect(insert.execute).toHaveBeenCalled();
    });
  });
});