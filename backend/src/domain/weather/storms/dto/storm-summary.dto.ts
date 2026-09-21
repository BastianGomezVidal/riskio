import { ApiProperty } from '@nestjs/swagger';
import { ForecastPoint } from '../../advisories/entities/forecast-point.entity.js';
import { Storm } from '../entities/storm.entity.js';

export class LatestAdvisoryDto {
  @ApiProperty({ description: 'Advisory UUID' })
  id: string;

  @ApiProperty({ description: 'NHC advisory number', example: 20 })
  advisoryNumber: number;

  @ApiProperty({
    description: 'Issue timestamp',
    example: '2017-09-08T02:33:27.000Z',
  })
  issuedAt: string;

  @ApiProperty({
    type: () => ForecastPoint,
    isArray: true,
    description: 'Forecast track points for this advisory',
  })
  forecastPoints: ForecastPoint[];
}

export class StormSummaryDto {
  @ApiProperty({ description: 'The storm row' })
  storm: Storm;

  @ApiProperty({
    type: () => LatestAdvisoryDto,
    nullable: true,
    description: 'Latest advisory, or null when none exists yet',
  })
  latestAdvisory: LatestAdvisoryDto | null;
}
