import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storm } from './entities/storm.entity.js';
import { StormDetailDto } from './dto/storm-detail.dto.js';

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
   * Fetch one storm by ATCF identifier with its lightweight advisory
   * references.
   *
   * The advisories are loaded as plain rows reduced to their identity
   * fields (id, advisoryNumber, issuedAt). ForecastPoints, warnings,
   * track and cone are NOT loaded here — fetch GET /advisories/:id for
   * the full advisory.
   */
  async findOne(atcfId: string): Promise<StormDetailDto> {
    const storm = await this.stormsRepository.findOne({
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
    });

    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }

    return storm as StormDetailDto;
  }

  /**
   * Fetch the raw Storm row without loading relations.
   *
   * Used by the ingestion pipeline, which needs the entity to attach new
   * advisories but does not need the advisories relation loaded.
   */
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
