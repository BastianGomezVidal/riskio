import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForecastPoint } from './entities/forecast-point.entity.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';
import { ForecastPointDto } from '../providers/nhc/nhc-parser.js';
import { categoryFromWindKt } from '../storms/storm-category.js';
import { PaginatedResultDto } from '../common/dto/paginated-result.dto.js';
import { PageMetaDto } from '../common/dto/page-meta.dto.js';
import { PageQueryDto } from '../common/dto/page-query.dto.js';

@Injectable()
export class ForecastPointsService {
  constructor(
    @InjectRepository(ForecastPoint)
    private readonly forecastPointsRepository: Repository<ForecastPoint>,
  ) {}

  /**
   * List an advisory's forecast points chronologically, paginated.
   */
  async findByAdvisory(
    advisoryId: string,
    page: PageQueryDto,
  ): Promise<PaginatedResultDto<ForecastPoint>> {
    const [data, total] = await this.forecastPointsRepository.findAndCount({
      where: { advisory: { id: advisoryId } },
      order: { validAt: 'ASC' },
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
   * Replace all forecast points of an advisory with the given ones.
   *
   * Advisories are immutable in this system, so "replace" effectively means
   * "write once": the delete is a no-op on first ingest. Saffir-Simpson
   * categories are derived from each point's wind speed.
   *
   * @returns the number of points stored.
   */
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
