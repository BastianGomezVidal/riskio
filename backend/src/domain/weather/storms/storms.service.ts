import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storm } from './entities/storm.entity.js';
import { StormDetailDto } from './dto/storm-detail.dto.js';

@Injectable()
export class StormsService {
  constructor(
    @InjectRepository(Storm)
    private readonly stormsRepository: Repository<Storm>,
  ) {}

  /**
   * List known storms ordered by most recently observed.
   *
   * @returns all storms ordered by `lastSeenAt` descending.
   */
  async findAll(): Promise<Storm[]> {
    return this.stormsRepository.find({
      order: { lastSeenAt: 'DESC' },
    });
  }

  /**
   * Fetch one storm by ATCF identifier with its advisories.
   *
   * Advisories are loaded without their own relations (no forecastPoints,
   * no warnings). That's the shape StormDetailDto advertises.
   *
   * @param atcfId ATCF storm identifier, e.g. `EP142026`.
   * @returns the storm with its `advisories` relation loaded.
   * @throws NotFoundException when no storm matches.
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
