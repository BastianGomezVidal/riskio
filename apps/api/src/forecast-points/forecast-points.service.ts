import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForecastPoint } from './entities/forecast-point.entity.js';

@Injectable()
export class ForecastPointsService {
  constructor(
    @InjectRepository(ForecastPoint)
    private readonly forecastPointsRepository: Repository<ForecastPoint>,
  ) {}

  findByAdvisory(advisoryId: string): Promise<ForecastPoint[]> {
    return this.forecastPointsRepository.find({
      where: { advisory: { id: advisoryId } },
      order: { validAt: 'ASC' },
    });
  }
}