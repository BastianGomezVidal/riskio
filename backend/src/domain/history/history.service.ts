import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { Advisory } from '../weather/advisories/entities/advisory.entity.js';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto.js';
import { PageMetaDto } from '../../common/dto/page-meta.dto.js';
import { PageQueryDto } from '../../common/dto/page-query.dto.js';
import { StormHistoryItemDto } from './dto/storm-history-item.dto.js';

/**
 * Read model for the history page: storms no longer present in the active
 * NOAA feed, each with its advisory count.
 *
 * Does NOT load advisories or forecast data. The storm detail is where
 * that lives.
 */
@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(Storm)
    private readonly stormsRepository: Repository<Storm>,

    @InjectRepository(Advisory)
    private readonly advisoriesRepository: Repository<Advisory>,
  ) {}

  async findHistory(
    page: PageQueryDto,
  ): Promise<PaginatedResultDto<StormHistoryItemDto>> {
    const [storms, total] = await this.stormsRepository.findAndCount({
      where: { isActive: false },
      order: { lastSeenInFeedAt: 'DESC' },
      skip: (page.page - 1) * page.limit,
      take: page.limit,
    });

    const meta: PageMetaDto = {
      total,
      page: page.page,
      limit: page.limit,
      pageCount: Math.ceil(total / page.limit),
      hasNextPage: page.page * page.limit < total,
    };

    if (storms.length === 0) {
      return new PaginatedResultDto(meta, []);
    }

    const atcfIds = storms.map((s) => s.atcfId);

    const countRows = await this.advisoriesRepository
      .createQueryBuilder('a')
      .select('a.storm_atcf_id', 'atcf_id')
      .addSelect('COUNT(*)', 'count')
      .where('a.storm_atcf_id IN (:...atcfIds)', { atcfIds })
      .groupBy('a.storm_atcf_id')
      .getRawMany<{ atcf_id: string; count: string }>();

    const countByAtcfId = new Map(
      countRows.map((r) => [r.atcf_id, Number(r.count)]),
    );

    const data: StormHistoryItemDto[] = storms.map((storm) => ({
      storm,
      advisoryCount: countByAtcfId.get(storm.atcfId) ?? 0,
      lastSeenInFeedAt: storm.lastSeenInFeedAt,
    }));

    return new PaginatedResultDto(meta, data);
  }
}
