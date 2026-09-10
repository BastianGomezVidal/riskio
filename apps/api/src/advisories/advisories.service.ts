import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Advisory } from './entities/advisory.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';
import { PageMetaDto } from '../common/dto/page-meta.dto.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { ForecastPoint } from '../forecast-points/entities/forecast-point.entity.js';

export interface AdvisoryDetail extends Advisory {
  forecastPoints: ForecastPoint[];
}

@Injectable()
export class AdvisoriesService {
  constructor(
    @InjectRepository(Advisory)
    private readonly advisoriesRepository: Repository<Advisory>,
  ) {}

  async findByStorm(
    stormAtcfId: string,
    page: PageQueryDto,
  ): Promise<PaginatedResultDto<Advisory>> {
    const [data, total] = await this.advisoriesRepository.findAndCount({
      where: { storm: { atcfId: stormAtcfId } },
      order: { advisoryNumber: 'DESC' },
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

  async findOne(id: string): Promise<AdvisoryDetail> {
    const advisory = await this.advisoriesRepository.findOne({
      where: { id },
      relations: { forecastPoints: true },
    });
    if (!advisory) {
      throw new NotFoundException(`Advisory ${id} not found`);
    }
    return advisory as AdvisoryDetail;
  }

  async upsertFromIngestion(input: {
    storm: Storm;
    advisoryNumber: number;
    issuedAt: Date;
    rawText: string | null;
  }): Promise<{ advisory: Advisory; inserted: boolean }> {
    // INSERT ... ON CONFLICT DO NOTHING to avoid a find-then-create race.
    // identifier is only returned for actually-inserted rows (the RETURNING
    // clause doesn't match rows skipped due to a unique-violation conflict).
    const result = await this.advisoriesRepository
      .createQueryBuilder()
      .insert()
      .into(Advisory)
      .values({
        storm: input.storm,
        advisoryNumber: input.advisoryNumber,
        issuedAt: input.issuedAt,
        rawText: input.rawText,
      })
      .orIgnore()
      .execute();

    // In TypeORM, a skipped ON CONFLICT row still yields a `null` element in
    // `identifiers`, so detect a real insert by looking for a non-null id.
    const inserted = result.identifiers.some((id) => id != null);

    const advisory = await this.advisoriesRepository.findOneOrFail({
      where: {
        storm: { atcfId: input.storm.atcfId },
        advisoryNumber: input.advisoryNumber,
      },
    });
    return { advisory, inserted };
  }
}