import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Repository } from 'typeorm';
import { HistoryService } from './storm-history.service.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { Advisory } from '../weather/advisories/entities/advisory.entity.js';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';

/**
 * Creates a minimal valid (inactive) Storm entity for history tests.
 */
function makeStorm(overrides: Partial<Storm> = {}): Storm {
  return {
    atcfId: 'AL112017',
    name: 'Harvey',
    basin: 'AL',
    firstSeenAt: new Date('2026-09-10T00:00:00Z'),
    lastSeenAt: new Date('2026-09-10T01:00:00Z'),
    isActive: false,
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

describe('HistoryService', () => {
  let findAndCount: ReturnType<typeof vi.fn>;
  let getRawMany: ReturnType<typeof vi.fn>;
  let queryBuilder: {
    select: ReturnType<typeof vi.fn>;
    addSelect: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    getRawMany: ReturnType<typeof vi.fn>;
  };
  let service: HistoryService;

  beforeEach(() => {
    findAndCount = vi.fn();
    getRawMany = vi.fn().mockResolvedValue([]);

    queryBuilder = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany,
    };

    const stormsRepo = { findAndCount } as unknown as Repository<Storm>;
    const advisoriesRepo = {
      createQueryBuilder: vi.fn(() => queryBuilder),
    } as unknown as Repository<Advisory>;

    service = new HistoryService(stormsRepo, advisoriesRepo);
  });

  it('paginates inactive storms and reports page metadata', async () => {
    const storm = makeStorm();
    findAndCount.mockResolvedValue([[storm], 45]);
    getRawMany.mockResolvedValue([{ atcf_id: 'AL112017', count: '3' }]);

    const result = await service.findStormHistory(makePage(1, 20));

    expect(findAndCount).toHaveBeenCalledWith({
      where: { isActive: false },
      order: { lastSeenInFeedAt: 'DESC' },
      skip: 0,
      take: 20,
    });

    expect(result.meta).toEqual({
      total: 45,
      page: 1,
      limit: 20,
      pageCount: 3,
      hasNextPage: true,
    });

    expect(result.data).toEqual([
      {
        storm,
        advisoryCount: 3,
        lastSeenInFeedAt: storm.lastSeenInFeedAt,
      },
    ]);
  });

  it('derives the offset from the requested page', async () => {
    findAndCount.mockResolvedValue([[], 45]);

    await service.findStormHistory(makePage(3, 10));

    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('returns advisoryCount zero when no advisories exist', async () => {
    const storm = makeStorm();
    findAndCount.mockResolvedValue([[storm], 1]);
    getRawMany.mockResolvedValue([]);

    const result = await service.findStormHistory(makePage());

    expect(result.data).toEqual([
      {
        storm,
        advisoryCount: 0,
        lastSeenInFeedAt: storm.lastSeenInFeedAt,
      },
    ]);
  });

  it('reports no next page on the last exact page', async () => {
    findAndCount.mockResolvedValue([[], 20]);

    const result = await service.findStormHistory(makePage(2, 10));

    expect(result.meta).toEqual({
      total: 20,
      page: 2,
      limit: 10,
      pageCount: 2,
      hasNextPage: false,
    });
  });

  it('returns an empty page without querying advisories when no storms match', async () => {
    findAndCount.mockResolvedValue([[], 0]);

    const result = await service.findStormHistory(makePage());

    expect(result.meta.pageCount).toBe(0);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.data).toEqual([]);
    expect(getRawMany).not.toHaveBeenCalled();
  });

  it('propagates repository failures', async () => {
    const error = new Error('database down');
    findAndCount.mockRejectedValue(error);

    await expect(service.findStormHistory(makePage())).rejects.toBe(error);
  });
});
