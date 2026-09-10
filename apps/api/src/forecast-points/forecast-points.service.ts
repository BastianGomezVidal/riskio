import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';
import {
  categoryFromWindKt,
  ForecastPointDto,
} from '../ingestion/nhc-parser.js';

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

  async replaceForAdvisory(
    advisory: Advisory,
    points: ForecastPointDto[],
  ): Promise<number> {
    // Simplest correct strategy: replace all points for this advisory.
    // Advisories are immutable, so "replace" == "insert once".
    await this.forecastPointsRepository.delete({
      advisory: { id: advisory.id },
    });

    if (points.length === 0) return 0;

    const entities = this.forecastPointsRepository.create(
      points.map((p) => ({
        advisory,
        validAt: p.validAt,
        latitude: p.latitude,
        longitude: p.longitude,
        windSpeedKt: p.windSpeedKt,
        pressureMb: p.pressureMb,
        category: categoryFromWindKt(p.windSpeedKt),
      })),
    );

    await this.forecastPointsRepository.save(entities);
    return entities.length;
  }
}
