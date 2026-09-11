import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { LineString, Polygon } from 'geojson';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
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
  const findAndCount = vi.fn();
  const findOne = vi.fn();
  const findOneOrFail = vi.fn();
  const update = vi.fn();
  const exists = vi.fn();
  const repo = {
    findAndCount,
    findOne,
    findOneOrFail,
    update,
    exists,
    createQueryBuilder: vi.fn(() => insert),
  } as unknown as Repository<Advisory>;
  return { repo, insert, findAndCount, findOne, findOneOrFail, update, exists };
}

function makeWarningsRepository() {
  const deleteFn = vi.fn();
  const create = vi.fn();
  const save = vi.fn();
  const find = vi.fn();
  const warningsRepo = {
    delete: deleteFn,
    create,
    save,
    find,
  } as unknown as Repository<Warning>;
  return { warningsRepo, deleteFn, create, save, find };
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
    track: null,
    cone: null,
    warnings: [],
    ...overrides,
  };
}

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

const page = { page: 1, limit: 20 };

describe('AdvisoriesService', () => {
  let repo: Repository<Advisory>;
  let insert: ReturnType<typeof makeInsertMock>;
  let findAndCount: ReturnType<typeof vi.fn>;
  let findOne: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let exists: ReturnType<typeof vi.fn>;
  let warningsRepo: Repository<Warning>;
  let deleteWarnings: ReturnType<typeof vi.fn>;
  let createWarnings: ReturnType<typeof vi.fn>;
  let saveWarnings: ReturnType<typeof vi.fn>;
  let findWarnings: ReturnType<typeof vi.fn>;
  let service: AdvisoriesService;

  beforeEach(() => {
    const built = makeRepository();
    repo = built.repo;
    insert = built.insert;
    findAndCount = built.findAndCount;
    findOne = built.findOne;
    findOneOrFail = built.findOneOrFail;
    update = built.update;
    exists = built.exists;

    const warnings = makeWarningsRepository();
    warningsRepo = warnings.warningsRepo;
    deleteWarnings = warnings.deleteFn;
    createWarnings = warnings.create;
    saveWarnings = warnings.save;
    findWarnings = warnings.find;

    service = new AdvisoriesService(repo, warningsRepo);
  });

  describe('findByStorm', () => {
    it('returns paginated advisories for a storm, newest first', async () => {
      const advisories = [makeAdvisory(), makeAdvisory({ advisoryNumber: 1 })];
      findAndCount.mockResolvedValue([advisories, 2]);

      const result = await service.findByStorm('EP142026', page);

      expect(findAndCount).toHaveBeenCalledWith(
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
    it('returns a single advisory with forecast points and warnings', async () => {
      const advisory = makeAdvisory({
        forecastPoints: [{ id: 'pt-1' } as never],
        warnings: [makeWarning()],
      });
      findOne.mockResolvedValue(advisory);

      const result = await service.findOne('adv-1');
      expect(findOne).toHaveBeenCalledWith({
        where: { id: 'adv-1' },
        relations: { forecastPoints: true, warnings: true },
      });
      expect(result.forecastPoints).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
    });

    it('throws NotFoundException for an unknown advisory', async () => {
      findOne.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setTrackCone', () => {
    it('updates the advisory with track and cone GeoJSON', async () => {
      const track: LineString = {
        type: 'LineString',
        coordinates: [
          [-120.5, 16.5],
          [-122.5, 16.5],
        ],
      };
      const cone: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-120.5, 16.5],
            [-118.5, 15.5],
          ],
        ],
      };

      await service.setTrackCone('adv-1', track, cone);

      expect(update).toHaveBeenCalledWith('adv-1', { track, cone });
    });

    it('clears geometry when a product was never published', async () => {
      await service.setTrackCone('adv-1', null, null);
      expect(update).toHaveBeenCalledWith('adv-1', { track: null, cone: null });
    });
  });

  describe('replaceWarnings', () => {
    it('replaces all segments and returns the stored count', async () => {
      const advisory = makeAdvisory();
      const segments = [
        {
          warningType: 'Hurricane Watch',
          geometry: {
            type: 'LineString' as const,
            coordinates: [[-80.5, 25.9]],
          },
        },
        {
          warningType: 'Tropical Storm Warning',
          geometry: {
            type: 'LineString' as const,
            coordinates: [[-79.5, 26.1]],
          },
        },
      ];
      createWarnings.mockReturnValue([{ id: 'w-1' }, { id: 'w-2' }]);

      const count = await service.replaceWarnings(advisory, segments);

      expect(deleteWarnings).toHaveBeenCalledWith({
        advisory: { id: 'adv-1' },
      });
      expect(createWarnings).toHaveBeenCalledWith(
        segments.map((segment) => ({
          advisory,
          warningType: segment.warningType,
          geometry: segment.geometry,
        })),
      );
      expect(saveWarnings).toHaveBeenCalled();
      expect(count).toBe(2);
    });

    it('deletes existing segments and returns 0 when none are provided', async () => {
      const count = await service.replaceWarnings(makeAdvisory(), []);

      expect(deleteWarnings).toHaveBeenCalled();
      expect(createWarnings).not.toHaveBeenCalled();
      expect(saveWarnings).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });

  describe('findWarnings', () => {
    it('returns a GeoJSON FeatureCollection of warning segments', async () => {
      exists.mockResolvedValue(true);
      findWarnings.mockResolvedValue([makeWarning()]);

      const result = await service.findWarnings('adv-1');

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0]).toEqual({
        type: 'Feature',
        properties: { warningType: 'Hurricane Watch' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-80.5, 25.9],
            [-80.4, 26.1],
          ],
        },
      });
    });

    it('throws NotFoundException for an unknown advisory', async () => {
      exists.mockResolvedValue(false);
      await expect(service.findWarnings('nope')).rejects.toThrow(
        NotFoundException,
      );
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
      findOneOrFail.mockResolvedValue(makeAdvisory());

      const result = await service.upsertFromIngestion(input);

      expect(insert.orIgnore).toHaveBeenCalled();
      expect(result.inserted).toBe(true);
      expect(findOneOrFail).toHaveBeenCalled();
    });

    it('reports inserted=false when ON CONFLICT skips (identifiers has null)', async () => {
      // TypeORM yields [null] for a skipped ON CONFLICT DO NOTHING row
      insert.execute.mockResolvedValue({
        identifiers: [null],
        generatedMaps: [{}],
      });
      findOneOrFail.mockResolvedValue(makeAdvisory());

      const result = await service.upsertFromIngestion(input);

      expect(result.inserted).toBe(false);
    });

    it('issues INSERT ... ON CONFLICT DO NOTHING', async () => {
      insert.execute.mockResolvedValue({ identifiers: [{ id: 'adv-new' }] });
      findOneOrFail.mockResolvedValue(makeAdvisory());

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
