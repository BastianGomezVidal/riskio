import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storm } from './entities/storm.entity.js';

@Injectable()
export class StormsService {
  constructor(
    @InjectRepository(Storm)
    private readonly stormsRepository: Repository<Storm>,
  ) {}

  findAll(): Promise<Storm[]> {
    return this.stormsRepository.find({
      order: { lastSeenAt: 'DESC' },
    });
  }

  async findOne(atcfId: string): Promise<Storm> {
    const storm = await this.stormsRepository.findOne({
      where: { atcfId },
      relations: { advisories: true },
    });
    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }
    return storm;
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
      },
      { conflictPaths: ['atcfId'] },
    );
    return this.stormsRepository.findOneOrFail({
      where: { atcfId: input.atcfId },
    });
  }
}
