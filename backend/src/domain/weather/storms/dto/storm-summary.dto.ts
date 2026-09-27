import { ApiProperty } from '@nestjs/swagger';
import { ForecastPoint } from '../../advisories/entities/forecast-point.entity.js';
import { StormDto } from './storm.dto.js';
import type { RiskLevel } from '../utils/storm-types.js';

export class LatestAdvisoryDto {
  @ApiProperty({ description: 'Advisory UUID' })
  id: string;

  @ApiProperty({ description: 'NHC advisory number', example: 20 })
  advisoryNumber: number;

  @ApiProperty({ description: 'Issue timestamp' })
  issuedAt: string;

  @ApiProperty({
    type: () => ForecastPoint,
    isArray: true,
    description: 'Forecast track points for this advisory',
  })
  forecastPoints: ForecastPoint[];
}

export class StormSummaryDto {
  @ApiProperty({
    description: 'Storm aggregate with counters',
    type: () => StormDto,
  })
  storm: StormDto;

  @ApiProperty({
    description:
      'Risk level derived from the latest advisory first forecast point',
    enum: ['low', 'moderate', 'high'],
  })
  riskLevel: RiskLevel;

  @ApiProperty({
    type: () => LatestAdvisoryDto,
    nullable: true,
    description: 'Latest advisory, or null when none exists yet',
  })
  latestAdvisory: LatestAdvisoryDto | null;
}
