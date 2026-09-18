import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { LineString, Polygon } from 'geojson';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';
import { Warning } from './entities/warning.entity.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';
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
function makeWarningsRepository() {
  const deleteFn = vi.fn();
  const create = vi.fn();
  const save = vi.fn();

  const warningsRepo = {
    delete: deleteFn,
    create,
    save,
  } as unknown as Repository<Warning>;

  return {
    warningsRepo,
    deleteFn,
    create,
    save,
  };
}

/**
 * Creates the forecast point repository mock used by the service tests.
 */
function makeForecastPointsRepository() {
  const deleteFn = vi.fn();
  const create = vi.fn();
  const save = vi.fn();

  const forecastPointsRepo = {
    delete: deleteFn,
    create,
    save,
  } as unknown as Repository<ForecastPoint>;

  return {
    forecastPointsRepo,
    deleteFn,
    create,
    save,
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
 * Creates a minimal forecast point payload as the parser would emit.
 */
function makeForecastPointDto(overrides: Record<string, unknown> = {}) {
  return {
    validAt: new Date('2026-09-10T12:00:00Z'),
    latitude: 16.7,
    longitude: -118.5,
    windSpeedKt: 35,
    pressureMb: null,
    ...overrides,
  };
}

describe('AdvisoriesService', () => {
  let repo: Repository<Advisory>;
  let insert: ReturnType<typeof makeInsertMock>;
  let findOne: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;

  let warningsRepo: Repository<Warning>;
  let deleteWarnings: ReturnType<typeof vi.fn>;
  let createWarnings: ReturnType<typeof vi.fn>;
  let saveWarnings: ReturnType<typeof vi.fn>;

  let forecastPointsRepo: Repository<ForecastPoint>;
  let deleteForecastPoints: ReturnType<typeof vi.fn>;
  let createForecastPoints: ReturnType<typeof vi.fn>;
  let saveForecastPoints: ReturnType<typeof vi.fn>;

  let service: AdvisoriesService;

  beforeEach(() => {
    const built = makeRepository();

    repo = built.repo;
    insert = built.insert;
    findOne = built.findOne;
    findOneOrFail = built.findOneOrFail;
    update = built.update;

    const warnings = makeWarningsRepository();

    warningsRepo = warnings.warningsRepo;
    deleteWarnings = warnings.deleteFn;
    createWarnings = warnings.create;
    saveWarnings = warnings.save;

    const fps = makeForecastPointsRepository();

    forecastPointsRepo = fps.forecastPointsRepo;
    deleteForecastPoints = fps.deleteFn;
    createForecastPoints = fps.create;
    saveForecastPoints = fps.save;

    service = new AdvisoriesService(repo, warningsRepo, forecastPointsRepo);
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

  describe('replaceForecastPoints', () => {
    it('deletes existing points and inserts the new ones', async () => {
      const advisory = makeAdvisory();
      const points = [
        makeForecastPointDto({ latitude: 16.7 }),
        makeForecastPointDto({ latitude: 16.8 }),
      ];

      const entities = [{ id: 'pt-1' }, { id: 'pt-2' }];
      createForecastPoints.mockReturnValue(entities);

      const count = await service.replaceForecastPoints(
        advisory,
        points as never,
      );

      expect(deleteForecastPoints).toHaveBeenCalledWith({
        advisory: { id: 'adv-1' },
      });

      expect(createForecastPoints).toHaveBeenCalledTimes(1);
      expect(saveForecastPoints).toHaveBeenCalledWith(entities);
      expect(count).toBe(2);
    });

    it('deletes existing points and returns zero when none are provided', async () => {
      const count = await service.replaceForecastPoints(makeAdvisory(), []);

      expect(deleteForecastPoints).toHaveBeenCalledWith({
        advisory: { id: 'adv-1' },
      });

      expect(createForecastPoints).not.toHaveBeenCalled();
      expect(saveForecastPoints).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('derives the Saffir-Simpson category from each point wind speed', async () => {
      const advisory = makeAdvisory();

      createForecastPoints.mockImplementation((values: unknown) => values);
      saveForecastPoints.mockResolvedValue(undefined);

      await service.replaceForecastPoints(advisory, [
        makeForecastPointDto({ windSpeedKt: 30 }) as never,
        makeForecastPointDto({ windSpeedKt: 70 }) as never,
        makeForecastPointDto({ windSpeedKt: 120 }) as never,
        makeForecastPointDto({ windSpeedKt: null }) as never,
      ]);

      const created = createForecastPoints.mock.calls[0][0] as Array<{
        category: number | null;
      }>;

      expect(created.map((p) => p.category)).toEqual([null, 1, 4, null]);
    });

    it('propagates delete errors', async () => {
      const error = new Error('delete failed');
      deleteForecastPoints.mockRejectedValue(error);

      await expect(
        service.replaceForecastPoints(makeAdvisory(), [
          makeForecastPointDto() as never,
        ]),
      ).rejects.toBe(error);

      expect(createForecastPoints).not.toHaveBeenCalled();
      expect(saveForecastPoints).not.toHaveBeenCalled();
    });

    it('propagates save errors', async () => {
      const error = new Error('save failed');

      createForecastPoints.mockReturnValue([{ id: 'pt-1' }]);
      saveForecastPoints.mockRejectedValue(error);

      await expect(
        service.replaceForecastPoints(makeAdvisory(), [
          makeForecastPointDto() as never,
        ]),
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
