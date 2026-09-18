import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ForecastPoint } from '../entities/forecast-point.entity.js';

export class WarningRefDto {
  @ApiProperty({ description: 'Warning segment UUID' })
  id: string;

  @ApiProperty({
    description: 'Watch/warning type',
    example: 'Hurricane Watch',
  })
  warningType: string;
}

/**
 * An advisory expanded with its forecastPoints and warnings relations.
 *
 * Returned by GET /advisories/:id. Warnings here are lightweight references
 * (id + type); fetch GET /advisories/:id/warnings for the full GeoJSON geometry.
 *
 * Intentionally does NOT extend `Advisory` — the extra fields are relations,
 * and inheritance would create unsafe narrowing on the base entity's types.
 */
export class AdvisoryDetailDto {
  @ApiProperty({ description: 'Advisory UUID' })
  id: string;

  @ApiProperty({ description: 'Advisory number for this storm', example: 20 })
  advisoryNumber: number;

  @ApiProperty({ description: 'When the advisory was issued' })
  issuedAt: Date;

  @ApiPropertyOptional({ description: 'Raw TCM forecast/advisory text' })
  rawText: string | null;

  @ApiProperty({ description: 'When this record was ingested' })
  ingestedAt: Date;

  @ApiPropertyOptional({
    description: 'Forecast track polyline (GeoJSON LineString)',
    nullable: true,
  })
  track: { type: 'LineString'; coordinates: [number, number][] } | null;

  @ApiPropertyOptional({
    description: 'Cone of uncertainty (GeoJSON Polygon)',
    nullable: true,
  })
  cone: { type: 'Polygon'; coordinates: [number, number][][] } | null;

  @ApiProperty({
    type: () => ForecastPoint,
    isArray: true,
    description: 'Forecast track points for this advisory, ordered by validAt',
  })
  forecastPoints: ForecastPoint[];

  @ApiProperty({
    type: () => WarningRefDto,
    isArray: true,
    description: 'Coastal watch/warning segment references',
  })
  warnings: WarningRefDto[];
}
