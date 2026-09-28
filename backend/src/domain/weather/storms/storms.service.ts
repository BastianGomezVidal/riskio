import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storm } from './entities/storm.entity.js';
import { StormListQueryDto } from './dto/storm-list-query.dto.js';
import { StormSort, StormTab } from './utils/storm-enums.js';
import { StormDto, AdvisoryRefDto } from './dto/storm.dto.js';
import { CACHE_SERVICE } from '../../cache/cache.tokens.js';
import type { CacheService } from '../../cache/cache.service.js';

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

    @Inject(CACHE_SERVICE)
    private readonly cache: CacheService,
  ) {}

  async findOne(atcfId: string): Promise<StormDto> {
    const [storm, metrics] = await Promise.all([
      this.stormsRepository.findOne({
        where: { atcfId },
        relations: { advisories: true },
        select: {
          atcfId: true,
          name: true,
          basin: true,
          firstSeenAt: true,
          lastSeenAt: true,
          isActive: true,
          lastSeenInFeedAt: true,
          advisories: {
            id: true,
            advisoryNumber: true,
            issuedAt: true,
          },
        },
        order: {
          advisories: {
            advisoryNumber: 'DESC',
          },
        },
      }),
      this.stormsRepository
        .createQueryBuilder('s')
        .leftJoin('s.advisories', 'a')
        .select('COUNT(a.id)', 'advisoryCount')
        .addSelect('MAX(a.advisoryNumber)', 'latestAdvisoryNumber')
        .addSelect(
          `(
            SELECT a2."issuedAt"
            FROM advisories a2
            WHERE a2."storm_atcf_id" = s."atcfId"
            ORDER BY a2."advisoryNumber" DESC
            LIMIT 1
          )`,
          'latestAdvisoryIssuedAt',
        )
        .where('s.atcfId = :atcfId', { atcfId })
        .groupBy('s.atcfId')
        .getRawOne<{
          advisoryCount: string;
          latestAdvisoryNumber: string | null;
          latestAdvisoryIssuedAt: Date | null;
        }>(),
    ]);

    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }

    const advisories: AdvisoryRefDto[] = (storm.advisories ?? []).map((a) => ({
      id: a.id,
      advisoryNumber: a.advisoryNumber,
      issuedAt: a.issuedAt,
    }));

    return {
      atcfId: storm.atcfId,
      name: storm.name,
      basin: storm.basin,
      firstSeenAt: storm.firstSeenAt,
      lastSeenAt: storm.lastSeenAt,
      isActive: storm.isActive,
      lastSeenInFeedAt: storm.lastSeenInFeedAt,
      advisoryCount: metrics ? Number(metrics.advisoryCount) : 0,
      latestAdvisoryNumber:
        metrics?.latestAdvisoryNumber != null
          ? Number(metrics.latestAdvisoryNumber)
          : null,
      latestAdvisoryIssuedAt: metrics?.latestAdvisoryIssuedAt ?? null,
      advisories,
    };
  }

  async findMany(query: StormListQueryDto): Promise<StormDto[]> {
    const key = [
      'storms',
      query.tab,
      query.q ?? '',
      query.sort ?? '',
      query.basin ?? '',
      query.cat ?? '',
      query.yearFrom ?? '',
      query.yearTo ?? '',
    ].join(':');

    return this.cache.getOrSet(key, 60_000, () => this.computeFindMany(query));
  }

  private async computeFindMany(query: StormListQueryDto): Promise<StormDto[]> {
    const qb = this.stormsRepository
      .createQueryBuilder('s')
      .leftJoin('s.advisories', 'a')
      .select('s.atcfId', 'atcfId')
      .addSelect('s.name', 'name')
      .addSelect('s.basin', 'basin')
      .addSelect('s.firstSeenAt', 'firstSeenAt')
      .addSelect('s.lastSeenAt', 'lastSeenAt')
      .addSelect('s.isActive', 'isActive')
      .addSelect('s.lastSeenInFeedAt', 'lastSeenInFeedAt')
      .addSelect('COUNT(a.id)', 'advisoryCount')
      .addSelect('MAX(a.advisoryNumber)', 'latestAdvisoryNumber')
      .addSelect(
        `(
          SELECT a2."issuedAt"
          FROM advisories a2
          WHERE a2."storm_atcf_id" = s."atcfId"
          ORDER BY a2."advisoryNumber" DESC
          LIMIT 1
        )`,
        'latestAdvisoryIssuedAt',
      )
      .groupBy('s.atcfId');

    qb.andWhere('s.isActive = :isActive', {
      isActive: query.tab !== StormTab.Past,
    });

    if (query.q) {
      qb.andWhere('(LOWER(s.name) LIKE :q OR LOWER(s.atcfId) LIKE :q)', {
        q: `%${query.q.toLowerCase()}%`,
      });
    }

    if (query.basin) {
      const basins = query.basin.split(',').map((b) => b.trim().toUpperCase());
      qb.andWhere('s.basin IN (:...basins)', { basins });
    }

    if (query.yearFrom != null) {
      qb.andWhere('EXTRACT(YEAR FROM s."firstSeenAt") >= :yearFrom', {
        yearFrom: query.yearFrom,
      });
    }
    if (query.yearTo != null) {
      qb.andWhere('EXTRACT(YEAR FROM s."firstSeenAt") <= :yearTo', {
        yearTo: query.yearTo,
      });
    }

    if (query.cat) {
      const cats = query.cat
        .split(',')
        .map((c) => c.trim())
        .map((c) => (c.toLowerCase() === 'ts' ? '0' : c))
        .filter((c) => /^[0-5]$/.test(c))
        .map(Number);

      if (cats.length > 0) {
        qb.andWhere(
          `(
            SELECT fp2."category"
            FROM forecast_points fp2
            INNER JOIN advisories a3 ON a3."id" = fp2."advisory_id"
            WHERE a3."storm_atcf_id" = s."atcfId"
            ORDER BY fp2."validAt" ASC
            LIMIT 1
          ) IN (:...cats)`,
          { cats },
        );
      }
    }

    switch (query.sort) {
      case StormSort.Oldest:
        qb.orderBy('s.lastSeenInFeedAt', 'ASC', 'NULLS LAST');
        break;
      case StormSort.NameAsc:
        qb.orderBy('s.name', 'ASC', 'NULLS LAST');
        break;
      case StormSort.NameDesc:
        qb.orderBy('s.name', 'DESC', 'NULLS LAST');
        break;
      case StormSort.Newest:
      default:
        qb.orderBy('s.lastSeenInFeedAt', 'DESC', 'NULLS LAST');
    }

    const raw = await qb.getRawMany<{
      atcfId: string;
      name: string | null;
      basin: string;
      firstSeenAt: Date;
      lastSeenAt: Date;
      isActive: boolean;
      lastSeenInFeedAt: Date | null;
      advisoryCount: string;
      latestAdvisoryNumber: string | null;
      latestAdvisoryIssuedAt: Date | null;
    }>();

    return raw.map((row) => ({
      atcfId: row.atcfId,
      name: row.name,
      basin: row.basin,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      isActive: row.isActive,
      lastSeenInFeedAt: row.lastSeenInFeedAt,
      advisoryCount: Number(row.advisoryCount),
      latestAdvisoryNumber:
        row.latestAdvisoryNumber != null
          ? Number(row.latestAdvisoryNumber)
          : null,
      latestAdvisoryIssuedAt: row.latestAdvisoryIssuedAt ?? null,
    }));
  }

  async findOneRaw(atcfId: string): Promise<Storm> {
    const storm = await this.stormsRepository.findOne({
      where: { atcfId },
    });
    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }
    return storm;
  }

  async reconcileFromFeed(
    basin: string,
    summaries: FeedStormSummary[],
  ): Promise<void> {
    const now = new Date();

    await this.stormsRepository.manager.transaction(async (manager) => {
      await manager.update(Storm, { basin }, { isActive: false });

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
