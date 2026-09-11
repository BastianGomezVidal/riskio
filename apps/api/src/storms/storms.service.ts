import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storm } from './entities/storm.entity.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';
import { PageMetaDto } from '../common/dto/page-meta.dto.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';

/** A storm expanded with the advisories issued for it. */
export interface StormDetail extends Storm {
  advisories: Advisory[];
}

@Injectable()
export class StormsService {
  constructor(
    @InjectRepository(Storm)
    private readonly stormsRepository: Repository<Storm>,
  ) {}

  /**
   * List known storms ordered by most recently observed, paginated.
   *
   * @param page 1-indexed pagination parameters (`page`, `limit`).
   * @returns paginated storms ordered by `lastSeenAt` descending.
   */
  async findAll(page: PageQueryDto): Promise<PaginatedResultDto<Storm>> {
    const [data, total] = await this.stormsRepository.findAndCount({
      order: { lastSeenAt: 'DESC' },
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
   * Fetch one storm by ATCF identifier with its advisories.
   *
   * @param atcfId ATCF storm identifier, e.g. `EP142026`.
   * @returns the storm with its `advisories` relation loaded.
   * @throws NotFoundException when no storm matches.
   */
  async findOne(atcfId: string): Promise<StormDetail> {
    const storm = await this.stormsRepository.findOne({
      where: { atcfId },
      relations: { advisories: true },
    });
    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }
    return storm as StormDetail;
  }

  /**
   * Create the storm if unknown, otherwise update its name/basin.
   * Returns the freshly loaded row. Used by the ingestion pipeline.
   *
   * @param input ATCF id, nullable name and basin code.
   * @returns the persisted storm row.
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
      },
      { conflictPaths: ['atcfId'] },
    );
    return this.stormsRepository.findOneOrFail({
      where: { atcfId: input.atcfId },
    });
  }
}
