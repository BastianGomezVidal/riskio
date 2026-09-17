import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Advisory } from '../../advisories/entities/advisory.entity.js';

/**
 * A storm expanded with its advisories relation.
 *
 * The advisories returned here are the plain rows — their forecastPoints
 * and warnings relations are NOT loaded. Fetch an individual advisory
 * (GET /advisories/:id) to get the expanded version.
 *
 * Intentionally does NOT extend `Storm`. The relation we add (`advisories`)
 * is a subset of the base class's `Relation<Advisory[]>`, and TS forbids
 * narrowing a property via inheritance.
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
  })
  lastSeenInFeedAt: Date | null;

  @ApiPropertyOptional({
    type: () => Advisory,
    isArray: true,
    description:
      'Advisories issued for this storm, without forecastPoints or warnings',
  })
  advisories: Advisory[];
}
