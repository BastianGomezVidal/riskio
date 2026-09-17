import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storm } from './entities/storm.entity.js';
import { StormDetailDto } from './dto/storm-detail.dto.js';
import { PageQueryDto } from '../../../common/dto/page-query.dto.js';
import { PaginatedResultDto } from '../../../common/dto/paginated-result.dto.js';
import { PageMetaDto } from '../../../common/dto/page-meta.dto.js';

interface FeedStormSummary {
  atcfId: string;
  name: string | null;
  basin: string;
}

@Injectable()
export class StormsService {
  constructor(
    @InjectRepository(Storm)
    private readonly stormsRepository: Repository<Storm>,
  ) {}

  /**
   * Active storms, ordered by the most recent feed pass that saw them.
   * No pagination — the active set is bounded by what NOAA is tracking.
   */
  async findActive(): Promise<Storm[]> {
    return this.stormsRepository.find({
      where: { isActive: true },
      order: { lastSeenInFeedAt: 'DESC' },
    });
  }

  /**
   * Paginated list of historical (non-active) storms, newest-first by
   * the feed pass that last saw them.
   */
  async findHistory(page: PageQueryDto): Promise<PaginatedResultDto<Storm>> {
    const [data, total] = await this.stormsRepository.findAndCount({
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
    return new PaginatedResultDto(meta, data);
  }

  /**
   * Fetch one storm by ATCF identifier with its advisories relation.
   */
  async findOne(atcfId: string): Promise<StormDetailDto> {
    const storm = await this.stormsRepository.findOne({
      where: { atcfId },
      relations: { advisories: true },
    });
    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }
    return storm as StormDetailDto;
  }

  /**
   * Reconciles the activity state of all storms in a basin against the
   * authoritative list returned by the latest NOAA feed.
   *
   * Runs inside a transaction so a partial failure cannot leave the
   * basin half-flipped. A network error never reaches this method —
   * only a cleanly parsed feed does.
   *
   * @param basin The basin whose storms are being reconciled.
   * @param summaries Storms currently listed in the feed for `basin`.
   */
  async reconcileFromFeed(
    basin: string,
    summaries: FeedStormSummary[],
  ): Promise<void> {
    const now = new Date();

    await this.stormsRepository.manager.transaction(async (manager) => {
      // 1. Everything in this basin is inactive unless proven otherwise
      //    by the current feed.
      await manager.update(Storm, { basin }, { isActive: false });

      // 2. Upsert the storms the feed is currently reporting.
      for (const s of summaries) {
        await manager.upsert(
          Storm,
          {
            atcfId: s.atcfId,
            name: s.name,
            basin: s.basin,
            isActive: true,
            lastSeenInFeedAt: now,
          },
          { conflictPaths: ['atcfId'] },
        );
      }
    });
  }

  /**
   * Legacy ingestion helper. Kept for compatibility with code paths
   * that still call it directly. Prefer `reconcileFromFeed` for new
   * ingestion work — it handles the active-set flip atomically.
   */
  async upsertFromIngestion(input: {
    atcfId: string;
    name: string | null;
    basin: string;
  }): Promise<Storm> {
    await this.stormsRepository.upsert(
      {
        atcfId: input.atcfId,
        name: input.name,
        basin: input.basin,
        isActive: true,
        lastSeenInFeedAt: new Date(),
      },
      { conflictPaths: ['atcfId'] },
    );
    return this.stormsRepository.findOneOrFail({
      where: { atcfId: input.atcfId },
    });
  }
}
