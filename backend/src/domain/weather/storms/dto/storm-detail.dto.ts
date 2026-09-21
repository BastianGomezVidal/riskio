import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Lightweight advisory reference used in the storm detail listing.
 *
 * Contains only the fields needed to render the advisory card header. The
 * full advisory (forecastPoints, warnings, track, cone, rawText) is
 * fetched on demand from GET /advisories/:id.
 */
export class AdvisoryRefDto {
  @ApiProperty({ description: 'Advisory UUID' })
  id: string;

  @ApiProperty({ description: 'NHC advisory number', example: 22 })
  advisoryNumber: number;

  @ApiProperty({ description: 'Issue timestamp' })
  issuedAt: Date;
}

/**
 * A storm expanded with its advisories relation.
 *
 * Advisories are the plain rows reduced to their identity fields; the
 * forecastPoints, warnings, track and cone are NOT loaded here. Fetch an
 * individual advisory (GET /advisories/:id) for the full content.
 *
 * Intentionally does NOT extend `Storm`. The relation we add
 * (`advisories`) is a subset of the base class's `Relation<Advisory[]>`,
 * and TS forbids narrowing a property via inheritance.
 */
export class StormDetailDto {
  @ApiProperty({ description: 'ATCF storm identifier', example: 'EP142026' })
  atcfId: string;

  @ApiPropertyOptional({ description: 'Storm name, null when unnamed' })
  name: string | null;

  @ApiProperty({ description: 'Basin code', example: 'EP' })
  basin: string;

  @ApiProperty({ description: 'When the storm was first seen' })
  firstSeenAt: Date;

  @ApiProperty({ description: 'When the storm was last seen' })
  lastSeenAt: Date;

  @ApiProperty({
    description: 'Whether the storm appears in the latest NOAA feed',
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp of the feed pass that last saw this storm',
    nullable: true,
  })
  lastSeenInFeedAt: Date | null;

  @ApiPropertyOptional({
    type: () => AdvisoryRefDto,
    isArray: true,
    description:
      'Lightweight advisory references (id, number, issuedAt) ordered newest-first. ForecastPoints, warnings, track and cone are NOT loaded here.',
  })
  advisories: AdvisoryRefDto[];
}
