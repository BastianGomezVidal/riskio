import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Advisory } from './entities/advisory.entity.js';

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
}