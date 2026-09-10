import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Repository } from 'typeorm';
import { ForecastPointsService } from './forecast-points.service.js';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';

function makeRepository() {
  const findAndCount = vi.fn();
  const deletePoint = vi.fn();
  const create = vi.fn();
  const save = vi.fn();
  const repo = {
    findAndCount,
    delete: deletePoint,
    create,
    save,
  } as unknown as Repository<ForecastPoint>;
  return { repo, findAndCount, deletePoint, create, save };
}

function makeAdvisory(overrides: Partial<Advisory> = {}): Advisory {
  return {
    id: 'adv-1',
    advisoryNumber: 2,
    issuedAt: new Date('2026-09-10T00:00:00Z'),
    rawText: null,
    ingestedAt: new Date('2026-09-10T00:01:00Z'),
    storm: undefined as never,
    forecastPoints: [],
    ...overrides,
  };
}

const page = { page: 1, limit: 20 };

describe('ForecastPointsService', () => {
  let repo: Repository<ForecastPoint>;
  let service: ForecastPointsService;
  let findAndCount: ReturnType<typeof vi.fn>;
  let deletePoint: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mocks = makeRepository();
    repo = mocks.repo;
    findAndCount = mocks.findAndCount;
    deletePoint = mocks.deletePoint;
    create = mocks.create;
    save = mocks.save;
    service = new ForecastPointsService(repo);
  });

  describe('findByAdvisory', () => {
    it('returns paginated points ordered by validAt ascending', async () => {
      findAndCount.mockResolvedValue([[{ id: 'pt-1' }], 1]);

      const result = await service.findByAdvisory('adv-1', page);

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { advisory: { id: 'adv-1' } },
          order: { validAt: 'ASC' },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('replaceForAdvisory', () => {
    it('deletes existing points then inserts new ones with computed category', async () => {
      const advisory = makeAdvisory();
      const points = [
        {
          validAt: new Date('2026-09-10T12:00:00Z'),
          latitude: 16.7,
          longitude: -118.5,
          windSpeedKt: 35,
          pressureMb: null,
          category: 0,
        },
        {
          validAt: new Date('2026-09-11T00:00:00Z'),
          latitude: 16.8,
          longitude: -121.1,
          windSpeedKt: 80,
          pressureMb: null,
          category: 1,
        },
      ];
      const entities = [{ id: 'a' }, { id: 'b' }];
      deletePoint.mockResolvedValue({});
      create.mockReturnValue(entities);
      save.mockResolvedValue(entities);

      const count = await service.replaceForAdvisory(advisory, points);

      expect(deletePoint).toHaveBeenCalledWith({
        advisory: { id: 'adv-1' },
      });
      expect(create).toHaveBeenCalledWith([
        expect.objectContaining({
          advisory,
          validAt: points[0].validAt,
          latitude: 16.7,
          longitude: -118.5,
          windSpeedKt: 35,
          category: 0,
        }),
        expect.objectContaining({ windSpeedKt: 80, category: 1 }),
      ]);
      expect(save).toHaveBeenCalledWith(entities);
      expect(count).toBe(2);
    });

    it('returns 0 and skips insert when there are no points', async () => {
      const advisory = makeAdvisory();
      const count = await service.replaceForAdvisory(advisory, []);

      expect(count).toBe(0);
      expect(deletePoint).toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });
  });
});
