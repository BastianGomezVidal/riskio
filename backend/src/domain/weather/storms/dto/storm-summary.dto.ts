import { ApiProperty } from '@nestjs/swagger';
import { StormDto } from './storm.dto.js';
import type { RiskLevel } from '../utils/storm-types.js';

/**
 * A forecast point, as the API returns it.
 *
 * Was the `ForecastPoint` TypeORM entity, which put a database row in a
 * response body. That was harmless while the dashboard read it in-process, and
 * stopped being harmless the moment the data crossed the network: the entity
 * carries an `advisory` relation that serialises to something meaningless, and
 * a consumer had no way to know which of its fields were actually sent.
 *
 * The field names are unchanged, so nothing downstream of the wire moves.
 */
export class ForecastPointDto {
  @ApiProperty({ description: 'Forecast valid time' })
  validAt: string;

  @ApiProperty({ example: 16.7 })
  latitude: number;

  @ApiProperty({ example: -118.4 })
  longitude: number;

  @ApiProperty({ nullable: true, description: 'Sustained wind in knots' })
  windSpeedKt: number | null;

  @ApiProperty({ nullable: true, description: 'Central pressure in mbar' })
  pressureMb: number | null;

  @ApiProperty({ nullable: true, description: 'Saffir-Simpson category' })
  category: number | null;
}

export class LatestAdvisoryDto {
  @ApiProperty({ description: 'Advisory UUID' })
  id: string;

  @ApiProperty({ description: 'NHC advisory number', example: 20 })
  advisoryNumber: number;

  @ApiProperty({ description: 'Issue timestamp' })
  issuedAt: string;

  @ApiProperty({
    type: () => ForecastPointDto,
    isArray: true,
    description: 'Forecast track points for this advisory',
  })
  forecastPoints: ForecastPointDto[];
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
