import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';

/**
 * Creates a minimal mock of TypeORM's query-builder chains used by the
 * service.
 */
function makeInsertMock() {
  const chain = {
    insert: vi.fn(),
    into: vi.fn(),
    values: vi.fn(),
    orIgnore: vi.fn(),
    execute: vi.fn(),
    innerJoinAndSelect: vi.fn(),
    leftJoinAndSelect: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    getMany: vi.fn(),
  };

  chain.insert.mockReturnThis();
  chain.into.mockReturnThis();
  chain.values.mockReturnThis();
  chain.orIgnore.mockReturnThis();
  chain.innerJoinAndSelect.mockReturnThis();
  chain.leftJoinAndSelect.mockReturnThis();
  chain.where.mockReturnThis();
  chain.orderBy.mockReturnThis();
  chain.addOrderBy.mockReturnThis();

  return chain;
}

/**
 * Creates the advisory repository mock used by the service tests.
 */
function makeRepository() {
  const insert = makeInsertMock();

  const findOne = vi.fn();
  const findOneOrFail = vi.fn();
  const update = vi.fn();

  const repo = {
    findOne,
    findOneOrFail,
    update,
    createQueryBuilder: vi.fn(() => insert),
  } as unknown as Repository<Advisory>;

  return {
    repo,
    insert,
    findOne,
    findOneOrFail,
    update,
  };
}

/**
 * Creates the warning repository mock used by the service tests.
 */

/**
 * Creates the forecast point repository mock used by the service tests.
 */

/**
 * Creates a minimal valid Storm entity for service tests.
 */
function makeStorm(overrides: Partial<Storm> = {}): Storm {
  return {
    atcfId: 'EP142026',
    name: null,
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
 * Creates a minimal Advisory entity.
 */
function makeAdvisory(overrides: Partial<Advisory> = {}): Advisory {
  return {
    id: 'adv-1',
    advisoryNumber: 2,
    issuedAt: new Date('2026-09-10T00:00:00Z'),
    rawText: 'TCM advisory text',
    ingestedAt: new Date('2026-09-10T00:01:00Z'),
    storm: makeStorm(),
    forecastPoints: [],
    track: null,
    cone: null,
    warnings: [],
    ...overrides,
  };
}

/**
 * Creates a warning with a valid GeoJSON LineString.
 */
function makeWarning(overrides: Partial<Warning> = {}): Warning {
  return {
    id: 'w-1',
    warningType: 'Hurricane Watch',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-80.5, 25.9],
        [-80.4, 26.1],
      ],
    },
    advisory: makeAdvisory(),
    ...overrides,
  };
}

/**
 * Creates a valid GeoJSON LineString.
 */

/**
 * Creates a valid GeoJSON Polygon.
 */

/**
 * Creates a minimal forecast point payload as the parser would emit.
 */

describe('AdvisoriesService', () => {
  let repo: Repository<Advisory>;
  let insert: ReturnType<typeof makeInsertMock>;
  let findOne: ReturnType<typeof vi.fn>;

  let service: AdvisoriesService;

  beforeEach(() => {
    const built = makeRepository();

    repo = built.repo;
    insert = built.insert;
    findOne = built.findOne;

    service = new AdvisoriesService(repo);
  });

  describe('findOne', () => {
    it('returns a single advisory with forecast points and warnings', async () => {
      const advisory = makeAdvisory({
        forecastPoints: [{ id: 'pt-1' } as never],
        warnings: [makeWarning()],
      });

      findOne.mockResolvedValue(advisory);

      const result = await service.findOne('adv-1');

      expect(findOne).toHaveBeenCalledWith({
        where: {
          id: 'adv-1',
        },
        relations: {
          forecastPoints: true,
          warnings: true,
        },
      });

      expect(result).toBe(advisory);
      expect(result.forecastPoints).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
    });

    it('returns an advisory with empty related collections', async () => {
      const advisory = makeAdvisory({
        forecastPoints: [],
        warnings: [],
      });

      findOne.mockResolvedValue(advisory);

      const result = await service.findOne('adv-1');

      expect(result.forecastPoints).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('throws NotFoundException when the advisory does not exist', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-advisory')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('includes the requested id in the not-found error', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-advisory')).rejects.toThrow(
        'Advisory missing-advisory not found',
      );
    });

    it('propagates repository errors', async () => {
      const error = new Error('database unavailable');

      findOne.mockRejectedValue(error);

      await expect(service.findOne('adv-1')).rejects.toBe(error);
    });
  });

  describe('findLatestPerStorm', () => {
    function makeAdvisoryWithStorm(
      advisoryNumber: number,
      atcfId = 'EP142026',
      pointIds: string[] = [],
    ): Advisory {
      return makeAdvisory({
        id: `adv-${atcfId}-${advisoryNumber}`,
        advisoryNumber,
        storm: makeStorm({ atcfId }),
        forecastPoints: pointIds.map((id) => ({ id }) as never),
      });
    }

    const ATCF_IDS = ['EP142026', 'AL052026'];

    it('short-circuits when no atcf ids are supplied', async () => {
      const result = await service.findLatestPerStorm([]);

      expect(result).toEqual([]);
      expect(insert.where).not.toHaveBeenCalled();
      expect(insert.getMany).not.toHaveBeenCalled();
    });

    it('builds the batched join query against the supplied atcf ids', async () => {
      insert.getMany.mockResolvedValue([]);

      await service.findLatestPerStorm(ATCF_IDS);

      expect(insert.innerJoinAndSelect).toHaveBeenCalledWith(
        'a.storm',
        'storm',
      );
      expect(insert.leftJoinAndSelect).toHaveBeenCalledWith(
        'a.forecastPoints',
        'point',
      );
      expect(insert.where).toHaveBeenCalledWith(
        'storm.atcfId IN (:...atcfIds)',
        { atcfIds: ATCF_IDS },
      );
      expect(insert.orderBy).toHaveBeenCalledWith('storm.atcfId', 'ASC');
      expect(insert.addOrderBy).toHaveBeenCalledWith(
        'a.advisoryNumber',
        'DESC',
      );
      expect(insert.addOrderBy).toHaveBeenCalledWith('point.validAt', 'ASC');
    });

    it('returns the newest advisory for a single storm', async () => {
      insert.getMany.mockResolvedValue([
        makeAdvisoryWithStorm(5),
        makeAdvisoryWithStorm(4),
        makeAdvisoryWithStorm(3),
      ]);

      const result = await service.findLatestPerStorm(['EP142026']);

      expect(result).toHaveLength(1);
      expect(result[0].advisoryNumber).toBe(5);
    });

    it('returns one advisory per storm, newest for each', async () => {
      insert.getMany.mockResolvedValue([
        makeAdvisoryWithStorm(9, 'AL052026'),
        makeAdvisoryWithStorm(2, 'EP142026'),
        makeAdvisoryWithStorm(1, 'EP142026'),
      ]);

      const result = await service.findLatestPerStorm(ATCF_IDS);

      expect(result).toHaveLength(2);
      expect(result[0].storm.atcfId).toBe('AL052026');
      expect(result[0].advisoryNumber).toBe(9);
      expect(result[1].storm.atcfId).toBe('EP142026');
      expect(result[1].advisoryNumber).toBe(2);
    });

    it('populates the forecast points of the latest advisory', async () => {
      insert.getMany.mockResolvedValue([
        makeAdvisoryWithStorm(7, 'EP142026', ['pt-1', 'pt-2']),
      ]);

      const result = await service.findLatestPerStorm(['EP142026']);

      expect(
        result[0].forecastPoints.map((p) => (p as { id: string }).id),
      ).toEqual(['pt-1', 'pt-2']);
    });

    it('does not deduplicate distinct storms sharing no advisories', async () => {
      insert.getMany.mockResolvedValue([makeAdvisoryWithStorm(1, 'EP142026')]);

      const result = await service.findLatestPerStorm(['EP142026', 'CP062026']);

      expect(result).toHaveLength(1);
      expect(result[0].storm.atcfId).toBe('EP142026');
    });

    it('returns an empty list when no storm has advisories', async () => {
      insert.getMany.mockResolvedValue([]);

      const result = await service.findLatestPerStorm(ATCF_IDS);

      expect(result).toEqual([]);
    });

    it('propagates repository errors', async () => {
      const error = new Error('database unavailable');

      insert.getMany.mockRejectedValue(error);

      await expect(service.findLatestPerStorm(ATCF_IDS)).rejects.toBe(error);
    });
  });
});
