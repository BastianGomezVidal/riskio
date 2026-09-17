import { ApiProperty } from '@nestjs/swagger';
import { ForecastPoint } from '../../weather/forecast-points/entities/forecast-point.entity.js';
import { Storm } from '../../weather/storms/entities/storm.entity.js';

export class DashboardTotalsDto {
  @ApiProperty({ description: 'All storms in the database', example: 6 })
  events: number;

  @ApiProperty({ description: 'Storms with a non-null name', example: 4 })
  named: number;

  @ApiProperty({
    description:
      'Storms whose latest advisory has at least one hurricane-category point',
    example: 2,
  })
  hurricanes: number;

  @ApiProperty({
    description: 'Season ACE index (sum of wind² / 10⁴ over TS+ points)',
    example: 45.2,
  })
  ace: number;
}

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

export class DashboardSummaryDto {
  @ApiProperty({ description: 'ISO timestamp when this summary was generated' })
  generatedAt: string;

  @ApiProperty({ type: () => DashboardTotalsDto })
  totals: DashboardTotalsDto;

  @ApiProperty({ type: () => StormSummaryDto, isArray: true })
  storms: StormSummaryDto[];
}
