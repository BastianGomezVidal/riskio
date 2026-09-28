import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Repository } from 'typeorm';
import { AdvisoryWriter } from './advisory-writer.js';
import { Advisory } from '../../../weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../../weather/advisories/entities/forecast-point.entity.js';
import { Warning } from '../../../weather/advisories/entities/warning.entity.js';
import { Storm } from '../../../weather/storms/entities/storm.entity.js';
import type { LineString, Polygon } from 'geojson';

/**
 * These cases moved here from advisories.service.spec.ts along with the code,
 * because AdvisoriesService no longer writes anything. The write path of the
 * ingestion is what they cover, and the parts worth watching are the ones that
 * replace a whole set: a partially applied replacement leaves an advisory with
 * a mixture of old and new products that no feed ever described.
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

describe('AdvisoryWriter', () => {
  let insert: ReturnType<typeof makeInsertMock>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let deleteWarnings: ReturnType<typeof vi.fn>;
  let createWarnings: ReturnType<typeof vi.fn>;
  let saveWarnings: ReturnType<typeof vi.fn>;
  let deleteForecastPoints: ReturnType<typeof vi.fn>;
  let createForecastPoints: ReturnType<typeof vi.fn>;
  let saveForecastPoints: ReturnType<typeof vi.fn>;
  let writer: AdvisoryWriter;

  beforeEach(() => {
    const built = makeRepository();
    insert = built.insert;
    findOneOrFail = built.findOneOrFail;
    update = built.update;

    const warnings = makeWarningsRepository();
    deleteWarnings = warnings.deleteFn;
    createWarnings = warnings.create;
    saveWarnings = warnings.save;

    const fps = makeForecastPointsRepository();
    deleteForecastPoints = fps.deleteFn;
    createForecastPoints = fps.create;
    saveForecastPoints = fps.save;

    // Note the order: the writer takes advisories, forecast points, warnings.
    writer = new AdvisoryWriter(
      built.repo,
      fps.forecastPointsRepo,
      warnings.warningsRepo,
    );
  });

  describe('setTrackCone', () => {
    it('updates the advisory with track and cone GeoJSON', async () => {
      const track = makeLineString();
      const cone = makePolygon();

      await writer.setTrackCone('adv-1', track, cone);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track,
        cone,
      });
    });

    it('clears both geometries when both products are unavailable', async () => {
      await writer.setTrackCone('adv-1', null, null);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track: null,
        cone: null,
      });
    });

    it('clears only the track while preserving the cone', async () => {
      const cone = makePolygon();

      await writer.setTrackCone('adv-1', null, cone);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track: null,
        cone,
      });
    });

    it('clears only the cone while preserving the track', async () => {
      const track = makeLineString();

      await writer.setTrackCone('adv-1', track, null);

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

      await writer.setTrackCone('adv-1', track, null);

      expect(update).toHaveBeenCalledWith('adv-1', {
        track,
        cone: null,
      });
    });

    it('propagates repository errors', async () => {
      const error = new Error('update failed');

      update.mockRejectedValue(error);

      await expect(
        writer.setTrackCone('adv-1', makeLineString(), makePolygon()),
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

      const count = await writer.replaceForecastPoints(
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
      const count = await writer.replaceForecastPoints(makeAdvisory(), []);

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

      await writer.replaceForecastPoints(advisory, [
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
        writer.replaceForecastPoints(makeAdvisory(), [
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
        writer.replaceForecastPoints(makeAdvisory(), [
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

      const count = await writer.replaceWarnings(advisory, segments);

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
      const count = await writer.replaceWarnings(makeAdvisory(), []);

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

      const count = await writer.replaceWarnings(advisory, [segment]);

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

      await writer.replaceWarnings(advisory, [segment]);

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

      await writer.replaceWarnings(makeAdvisory(), [
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

      await expect(writer.replaceWarnings(makeAdvisory(), [])).rejects.toBe(
        error,
      );

      expect(createWarnings).not.toHaveBeenCalled();
      expect(saveWarnings).not.toHaveBeenCalled();
    });

    it('does not create or save warnings when deletion fails', async () => {
      deleteWarnings.mockRejectedValue(new Error('delete failed'));

      await expect(
        writer.replaceWarnings(makeAdvisory(), [
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
        writer.replaceWarnings(makeAdvisory(), [
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
        writer.replaceWarnings(makeAdvisory(), [
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

      const result = await writer.upsert(input);

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

      const result = await writer.upsert(input);

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

      const result = await writer.upsert(input);

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

      const result = await writer.upsert(input);

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

      await writer.upsert(input);

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

      await writer.upsert(input);

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

      await writer.upsert(inputWithoutRawText);

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

      const result = await writer.upsert(zeroAdvisoryInput);

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

      await writer.upsert(input);

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

      const result = await writer.upsert(input);

      expect(result.advisory).toBe(existingAdvisory);
      expect(result.inserted).toBe(false);
    });

    it('propagates insert errors', async () => {
      const error = new Error('insert failed');

      insert.execute.mockRejectedValue(error);

      await expect(writer.upsert(input)).rejects.toBe(error);

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

      await expect(writer.upsert(input)).rejects.toBe(error);
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

      await expect(writer.upsert(input)).rejects.toThrow(
        'lookup failed',
      );

      expect(insert.execute).toHaveBeenCalledTimes(1);
    });
  });
});
