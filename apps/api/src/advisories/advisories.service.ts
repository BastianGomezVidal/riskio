import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Advisory } from './entities/advisory.entity.js';
import { Storm } from '../storms/entities/storm.entity.js';

@Injectable()
export class AdvisoriesService {
  constructor(
    @InjectRepository(Advisory)
    private readonly advisoriesRepository: Repository<Advisory>,
  ) {}

  findByStorm(stormAtcfId: string): Promise<Advisory[]> {
    return this.advisoriesRepository.find({
      where: { storm: { atcfId: stormAtcfId } },
      order: { advisoryNumber: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Advisory> {
    const advisory = await this.advisoriesRepository.findOne({
      where: { id },
      relations: { forecastPoints: true },
    });
    if (!advisory) {
      throw new NotFoundException(`Advisory ${id} not found`);
    }
    return advisory;
  }

  async upsertFromIngestion(input: {
    storm: Storm;
    advisoryNumber: number;
    issuedAt: Date;
    rawText: string | null;
  }): Promise<{ advisory: Advisory; inserted: boolean }> {
    const existing = await this.advisoriesRepository.findOne({
      where: {
        storm: { atcfId: input.storm.atcfId },
        advisoryNumber: input.advisoryNumber,
      },
    });
    if (existing) {
      return { advisory: existing, inserted: false };
    }
    const created = this.advisoriesRepository.create({
      storm: input.storm,
      advisoryNumber: input.advisoryNumber,
      issuedAt: input.issuedAt,
      rawText: input.rawText,
    });
    const saved = await this.advisoriesRepository.save(created);
    return { advisory: saved, inserted: true };
  }
}
