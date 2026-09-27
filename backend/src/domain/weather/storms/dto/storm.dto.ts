import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdvisoryRefDto {
  @ApiProperty({ description: 'Advisory UUID' })
  id: string;

  @ApiProperty({ description: 'NHC advisory number', example: 22 })
  advisoryNumber: number;

  @ApiProperty({ description: 'Issue timestamp' })
  issuedAt: Date;
}

/**
 * Storm aggregate used across the app.
 *
 * Does NOT include `riskLevel` — that concept belongs to advisories, not
 * storms. The dashboard computes it separately.
 *
 * The `advisories` field is only populated by the detail endpoint.
 */
export class StormDto {
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

  @ApiProperty({
    description: 'Total advisories recorded for this storm',
  })
  advisoryCount: number;

  @ApiPropertyOptional({
    description:
      'Highest advisory number issued for this storm, or null when no ' +
      'advisories exist.',
    nullable: true,
  })
  latestAdvisoryNumber: number | null;

  @ApiPropertyOptional({
    description:
      'Issue timestamp of the latest advisory, or null when no advisories exist. ' +
      'Used to render the "Updated Xm ago" line on storm cards.',
    nullable: true,
  })
  latestAdvisoryIssuedAt: Date | null;

  @ApiPropertyOptional({
    type: () => AdvisoryRefDto,
    isArray: true,
    description:
      'Lightweight advisory references ordered newest-first. Only populated by GET /storms/:atcfId.',
  })
  advisories?: AdvisoryRefDto[];
}
