import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { LineString, Polygon } from 'geojson';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';

/**
 * Creates a minimal mock of TypeORM's insert query-builder chain.
 *
 * The service only uses:
 * insert -> into -> values -> orIgnore -> execute
 */
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

/**
 * Creates the advisory repository mock used by the service tests.
 */
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

  return {
    repo,
    insert,
    findAndCount,
    findOne,
    findOneOrFail,
    update,
    exists,
  };
}

/**
 * Creates the warning repository mock used by the service tests.
 */
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

  return {
    warningsRepo,
    deleteFn,
    create,
    save,
    find,
  };
}

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
function makeLineString(
  coordinates: number[][] = [
    [-120.5, 16.5],
    [-121.5, 17.0],
  ],
): LineString {
  return {
    type: 'LineString',
    coordinates,
  };
}

/**
 * Creates a valid GeoJSON Polygon.
 *
 * The first and last positions are identical, as required for a
 * GeoJSON linear ring.
 */
function makePolygon(): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [-120.5, 16.5],
        [-118.5, 15.5],
        [-118.0, 17.0],
        [-120.5, 16.5],
      ],
    ],
  };
}

/**
 * Creates a list of advisories with descending advisory numbers.
 */
function makeAdvisories(count: number): Advisory[] {
  return Array.from({ length: count }, (_, index) =>
    makeAdvisory({
      id: `adv-${index + 1}`,
      advisoryNumber: count - index,
    }),
  );
}

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
      const advisories = [
        makeAdvisory({ advisoryNumber: 5 }),
        makeAdvisory({ advisoryNumber: 4 }),
      ];

      findAndCount.mockResolvedValue([advisories, 5]);

      const result = await service.findByStorm('EP142026', {
        page: 1,
        limit: 2,
      });

      expect(findAndCount).toHaveBeenCalledWith({
        where: {
          storm: {
            atcfId: 'EP142026',
          },
        },
        order: {
          advisoryNumber: 'DESC',
        },
        skip: 0,
        take: 2,
      });

      expect(result.data).toEqual(advisories);
      expect(result.meta.total).toBe(5);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(2);
      expect(result.meta.pageCount).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
    });

    it('uses the correct skip offset for the second page', async () => {
      const advisories = [makeAdvisory({ advisoryNumber: 1 })];

      findAndCount.mockResolvedValue([advisories, 21]);

      const result = await service.findByStorm('EP142026', {
        page: 2,
        limit: 20,
      });

      expect(findAndCount).toHaveBeenCalledWith({
        where: {
          storm: {
            atcfId: 'EP142026',
          },
        },
        order: {
          advisoryNumber: 'DESC',
        },
        skip: 20,
        take: 20,
      });

      expect(result.data).toEqual(advisories);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(21);
      expect(result.meta.pageCount).toBe(2);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('uses the correct skip offset for a later page', async () => {
      findAndCount.mockResolvedValue([
        [makeAdvisory({ advisoryNumber: 1 })],
        101,
      ]);

      const result = await service.findByStorm('EP142026', {
        page: 6,
        limit: 20,
      });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 100,
          take: 20,
        }),
      );

      expect(result.meta.page).toBe(6);
      expect(result.meta.pageCount).toBe(6);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('returns an empty result when the storm has no advisories', async () => {
      findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByStorm('EP999999', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.pageCount).toBe(0);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('does not report a next page when total equals page size', async () => {
      const advisories = makeAdvisories(20);

      findAndCount.mockResolvedValue([advisories, 20]);

      const result = await service.findByStorm('EP142026', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(20);
      expect(result.meta.total).toBe(20);
      expect(result.meta.pageCount).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('reports a next page when exactly one item remains', async () => {
      const advisories = makeAdvisories(20);

      findAndCount.mockResolvedValue([advisories, 21]);

      const result = await service.findByStorm('EP142026', {
        page: 1,
        limit: 20,
      });

      expect(result.meta.pageCount).toBe(2);
      expect(result.meta.hasNextPage).toBe(true);
    });

    it('does not report a next page on the final partial page', async () => {
      const advisories = [makeAdvisory({ advisoryNumber: 1 })];

      findAndCount.mockResolvedValue([advisories, 21]);

      const result = await service.findByStorm('EP142026', {
        page: 2,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.pageCount).toBe(2);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('handles a single-item page size', async () => {
      findAndCount.mockResolvedValue([[makeAdvisory()], 3]);

      const result = await service.findByStorm('EP142026', {
        page: 1,
        limit: 1,
      });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 1,
        }),
      );

      expect(result.meta.pageCount).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
    });

    it('propagates repository errors', async () => {
      const error = new Error('database unavailable');

      findAndCount.mockRejectedValue(error);

      await expect(
        service.findByStorm('EP142026', {
          page: 1,
          limit: 20,
        }),
      ).rejects.toBe(error);
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

  describe('setTrackCone', () => {
    it('updates the advisory with track and cone GeoJSON', async () => {
      const track = makeLineString();
      const cone = makePolygon();

      await service.setTrackCone('adv-1', track, cone);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track,
        cone,
      });
    });

    it('clears both geometries when both products are unavailable', async () => {
      await service.setTrackCone('adv-1', null, null);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track: null,
        cone: null,
      });
    });

    it('clears only the track while preserving the cone', async () => {
      const cone = makePolygon();

      await service.setTrackCone('adv-1', null, cone);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track: null,
        cone,
      });
    });

    it('clears only the cone while preserving the track', async () => {
      const track = makeLineString();

      await service.setTrackCone('adv-1', track, null);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track,
        cone: null,
      });
    });

    it('supports a track with multiple forecast positions', async () => {
      const track = makeLineString([
        [-120.5, 16.5],
        [-121.5, 17.0],
        [-122.5, 17.5],
        [-123.5, 18.0],
      ]);

      await service.setTrackCone('adv-1', track, null);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track,
        cone: null,
      });
    });

    it('propagates repository errors', async () => {
      const error = new Error('update failed');

      update.mockRejectedValue(error);

      await expect(
        service.setTrackCone('adv-1', makeLineString(), makePolygon()),
      ).rejects.toBe(error);
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
            coordinates: [
              [-80.5, 25.9],
              [-80.4, 26.1],
            ],
          },
        },
        {
          warningType: 'Tropical Storm Warning',
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [-79.5, 26.1],
              [-79.2, 26.4],
            ],
          },
        },
      ];

      const entities = [{ id: 'w-1' }, { id: 'w-2' }];

      createWarnings.mockReturnValue(entities);

      const count = await service.replaceWarnings(advisory, segments);

      expect(deleteWarnings).toHaveBeenCalledWith({
        advisory: {
          id: 'adv-1',
        },
      });

      expect(createWarnings).toHaveBeenCalledWith(
        segments.map((segment) => ({
          advisory,
          warningType: segment.warningType,
          geometry: segment.geometry,
        })),
      );

      expect(saveWarnings).toHaveBeenCalledWith(entities);

      expect(count).toBe(2);
    });

    it('deletes existing segments and returns zero when none are provided', async () => {
      const count = await service.replaceWarnings(makeAdvisory(), []);

      expect(deleteWarnings).toHaveBeenCalledWith({
        advisory: {
          id: 'adv-1',
        },
      });

      expect(createWarnings).not.toHaveBeenCalled();
      expect(saveWarnings).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('stores exactly one warning segment', async () => {
      const advisory = makeAdvisory();

      const segment = {
        warningType: 'Hurricane Warning',
        geometry: makeLineString(),
      };

      const entity = {
        id: 'w-1',
      };

      createWarnings.mockReturnValue([entity]);

      const count = await service.replaceWarnings(advisory, [segment]);

      expect(createWarnings).toHaveBeenCalledWith([
        {
          advisory,
          warningType: segment.warningType,
          geometry: segment.geometry,
        },
      ]);

      expect(saveWarnings).toHaveBeenCalledWith([entity]);

      expect(count).toBe(1);
    });

    it('preserves the exact warning type', async () => {
      const advisory = makeAdvisory();

      const segment = {
        warningType: 'Tropical Storm Watch',
        geometry: makeLineString(),
      };

      createWarnings.mockReturnValue([{ id: 'w-1' }]);

      await service.replaceWarnings(advisory, [segment]);

      expect(createWarnings).toHaveBeenCalledWith([
        {
          advisory,
          warningType: 'Tropical Storm Watch',
          geometry: segment.geometry,
        },
      ]);
    });

    it('deletes before creating replacement warnings', async () => {
      const order: string[] = [];

      deleteWarnings.mockImplementation(async () => {
        order.push('delete');
      });

      createWarnings.mockImplementation(() => {
        order.push('create');
        return [{ id: 'w-1' }];
      });

      saveWarnings.mockImplementation(async () => {
        order.push('save');
      });

      await service.replaceWarnings(makeAdvisory(), [
        {
          warningType: 'Hurricane Watch',
          geometry: makeLineString(),
        },
      ]);

      expect(order).toEqual(['delete', 'create', 'save']);
    });

    it('propagates deletion errors', async () => {
      const error = new Error('delete failed');

      deleteWarnings.mockRejectedValue(error);

      await expect(service.replaceWarnings(makeAdvisory(), [])).rejects.toBe(
        error,
      );

      expect(createWarnings).not.toHaveBeenCalled();
      expect(saveWarnings).not.toHaveBeenCalled();
    });

    it('does not create or save warnings when deletion fails', async () => {
      deleteWarnings.mockRejectedValue(new Error('delete failed'));

      await expect(
        service.replaceWarnings(makeAdvisory(), [
          {
            warningType: 'Hurricane Watch',
            geometry: makeLineString(),
          },
        ]),
      ).rejects.toThrow('delete failed');

      expect(createWarnings).not.toHaveBeenCalled();
      expect(saveWarnings).not.toHaveBeenCalled();
    });

    it('propagates save errors', async () => {
      const error = new Error('save failed');

      createWarnings.mockReturnValue([{ id: 'w-1' }]);

      saveWarnings.mockRejectedValue(error);

      await expect(
        service.replaceWarnings(makeAdvisory(), [
          {
            warningType: 'Hurricane Watch',
            geometry: makeLineString(),
          },
        ]),
      ).rejects.toBe(error);
    });

    it('does not silently report success when save fails', async () => {
      createWarnings.mockReturnValue([{ id: 'w-1' }]);

      saveWarnings.mockRejectedValue(new Error('database unavailable'));

      await expect(
        service.replaceWarnings(makeAdvisory(), [
          {
            warningType: 'Hurricane Watch',
            geometry: makeLineString(),
          },
        ]),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('findWarnings', () => {
    it('returns a GeoJSON FeatureCollection of warning segments', async () => {
      exists.mockResolvedValue(true);
      findWarnings.mockResolvedValue([makeWarning()]);

      const result = await service.findWarnings('adv-1');

      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              warningType: 'Hurricane Watch',
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-80.5, 25.9],
                [-80.4, 26.1],
              ],
            },
          },
        ],
      });
    });

    it('returns an empty FeatureCollection when an advisory has no warnings', async () => {
      exists.mockResolvedValue(true);
      findWarnings.mockResolvedValue([]);

      const result = await service.findWarnings('adv-1');

      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [],
      });
    });

    it('maps multiple warnings independently', async () => {
      exists.mockResolvedValue(true);

      findWarnings.mockResolvedValue([
        makeWarning({
          id: 'w-1',
          warningType: 'Hurricane Watch',
        }),
        makeWarning({
          id: 'w-2',
          warningType: 'Tropical Storm Warning',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-79.5, 26.1],
              [-79.2, 26.4],
            ],
          },
        }),
      ]);

      const result = await service.findWarnings('adv-1');

      expect(result.type).toBe('FeatureCollection');

      expect(result.features).toHaveLength(2);

      expect(result.features[0]).toEqual({
        type: 'Feature',
        properties: {
          warningType: 'Hurricane Watch',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-80.5, 25.9],
            [-80.4, 26.1],
          ],
        },
      });

      expect(result.features[1]).toEqual({
        type: 'Feature',
        properties: {
          warningType: 'Tropical Storm Warning',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-79.5, 26.1],
            [-79.2, 26.4],
          ],
        },
      });
    });

    it('checks advisory existence before querying warnings', async () => {
      exists.mockResolvedValue(false);

      await expect(service.findWarnings('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(findWarnings).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown advisory', async () => {
      exists.mockResolvedValue(false);

      await expect(service.findWarnings('missing')).rejects.toThrow(
        'Advisory missing not found',
      );
    });

    it('queries warnings by advisory id', async () => {
      exists.mockResolvedValue(true);
      findWarnings.mockResolvedValue([]);

      await service.findWarnings('adv-123');

      expect(findWarnings).toHaveBeenCalledWith({
        where: {
          advisory: {
            id: 'adv-123',
          },
        },
      });
    });

    it('propagates advisory existence-check errors', async () => {
      const error = new Error('existence check failed');

      exists.mockRejectedValue(error);

      await expect(service.findWarnings('adv-1')).rejects.toBe(error);

      expect(findWarnings).not.toHaveBeenCalled();
    });

    it('propagates warning query errors', async () => {
      exists.mockResolvedValue(true);

      const error = new Error('warning query failed');

      findWarnings.mockRejectedValue(error);

      await expect(service.findWarnings('adv-1')).rejects.toBe(error);
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
      const advisory = makeAdvisory();

      insert.execute.mockResolvedValue({
        identifiers: [
          {
            id: 'adv-new',
          },
        ],
        generatedMaps: [
          {
            id: 'adv-new',
          },
        ],
      });

      findOneOrFail.mockResolvedValue(advisory);

      const result = await service.upsertFromIngestion(input);

      expect(result.advisory).toBe(advisory);
      expect(result.inserted).toBe(true);
    });

    it('reports inserted=false when ON CONFLICT returns a null identifier', async () => {
      const advisory = makeAdvisory();

      insert.execute.mockResolvedValue({
        identifiers: [null],
        generatedMaps: [{}],
      });

      findOneOrFail.mockResolvedValue(advisory);

      const result = await service.upsertFromIngestion(input);

      expect(result.advisory).toBe(advisory);
      expect(result.inserted).toBe(false);
    });

    it('reports inserted=false when ON CONFLICT returns no identifiers', async () => {
      const advisory = makeAdvisory();

      insert.execute.mockResolvedValue({
        identifiers: [],
        generatedMaps: [],
      });

      findOneOrFail.mockResolvedValue(advisory);

      const result = await service.upsertFromIngestion(input);

      expect(result.advisory).toBe(advisory);
      expect(result.inserted).toBe(false);
    });

    it('reports inserted=true when at least one identifier is non-null', async () => {
      const advisory = makeAdvisory();

      insert.execute.mockResolvedValue({
        identifiers: [
          null,
          {
            id: 'adv-new',
          },
        ],
      });

      findOneOrFail.mockResolvedValue(advisory);

      const result = await service.upsertFromIngestion(input);

      expect(result.inserted).toBe(true);
    });

    it('uses INSERT ... ON CONFLICT DO NOTHING', async () => {
      insert.execute.mockResolvedValue({
        identifiers: [
          {
            id: 'adv-new',
          },
        ],
      });

      findOneOrFail.mockResolvedValue(makeAdvisory());

      await service.upsertFromIngestion(input);

      expect(insert.insert).toHaveBeenCalledTimes(1);

      expect(insert.into).toHaveBeenCalledWith(Advisory);

      expect(insert.orIgnore).toHaveBeenCalledTimes(1);

      expect(insert.execute).toHaveBeenCalledTimes(1);
    });

    it('passes the storm and advisory fields to the insert', async () => {
      insert.execute.mockResolvedValue({
        identifiers: [
          {
            id: 'adv-new',
          },
        ],
      });

      findOneOrFail.mockResolvedValue(makeAdvisory());

      await service.upsertFromIngestion(input);

      expect(insert.values).toHaveBeenCalledWith({
        storm: input.storm,
        advisoryNumber: input.advisoryNumber,
        issuedAt: input.issuedAt,
        rawText: input.rawText,
      });
    });

    it('supports null raw advisory text', async () => {
      const inputWithoutRawText = {
        ...input,
        rawText: null,
      };

      insert.execute.mockResolvedValue({
        identifiers: [
          {
            id: 'adv-new',
          },
        ],
      });

      findOneOrFail.mockResolvedValue(
        makeAdvisory({
          rawText: null,
        }),
      );

      await service.upsertFromIngestion(inputWithoutRawText);

      expect(insert.values).toHaveBeenCalledWith({
        storm: input.storm,
        advisoryNumber: input.advisoryNumber,
        issuedAt: input.issuedAt,
        rawText: null,
      });
    });

    it('supports advisory number zero if supplied by the ingestion layer', async () => {
      const zeroAdvisoryInput = {
        ...input,
        advisoryNumber: 0,
      };

      insert.execute.mockResolvedValue({
        identifiers: [
          {
            id: 'adv-new',
          },
        ],
      });

      findOneOrFail.mockResolvedValue(
        makeAdvisory({
          advisoryNumber: 0,
        }),
      );

      const result = await service.upsertFromIngestion(zeroAdvisoryInput);

      expect(result.inserted).toBe(true);

      expect(insert.values).toHaveBeenCalledWith({
        storm: input.storm,
        advisoryNumber: 0,
        issuedAt: input.issuedAt,
        rawText: input.rawText,
      });
    });

    it('loads the advisory after insertion or conflict', async () => {
      const advisory = makeAdvisory();

      insert.execute.mockResolvedValue({
        identifiers: [],
      });

      findOneOrFail.mockResolvedValue(advisory);

      await service.upsertFromIngestion(input);

      expect(findOneOrFail).toHaveBeenCalledWith({
        where: {
          storm: {
            atcfId: 'EP142026',
          },
          advisoryNumber: 2,
        },
      });
    });

    it('returns the existing advisory after a conflict', async () => {
      const existingAdvisory = makeAdvisory({
        id: 'existing-advisory',
      });

      insert.execute.mockResolvedValue({
        identifiers: [null],
      });

      findOneOrFail.mockResolvedValue(existingAdvisory);

      const result = await service.upsertFromIngestion(input);

      expect(result.advisory).toBe(existingAdvisory);
      expect(result.inserted).toBe(false);
    });

    it('propagates insert errors', async () => {
      const error = new Error('insert failed');

      insert.execute.mockRejectedValue(error);

      await expect(service.upsertFromIngestion(input)).rejects.toBe(error);

      expect(findOneOrFail).not.toHaveBeenCalled();
    });

    it('propagates the advisory lookup error', async () => {
      insert.execute.mockResolvedValue({
        identifiers: [
          {
            id: 'adv-new',
          },
        ],
      });

      const error = new Error('lookup failed');

      findOneOrFail.mockRejectedValue(error);

      await expect(service.upsertFromIngestion(input)).rejects.toBe(error);
    });

    it('does not perform a second insert when lookup fails', async () => {
      insert.execute.mockResolvedValue({
        identifiers: [
          {
            id: 'adv-new',
          },
        ],
      });

      findOneOrFail.mockRejectedValue(new Error('lookup failed'));

      await expect(service.upsertFromIngestion(input)).rejects.toThrow(
        'lookup failed',
      );

      expect(insert.execute).toHaveBeenCalledTimes(1);
    });
  });
});
