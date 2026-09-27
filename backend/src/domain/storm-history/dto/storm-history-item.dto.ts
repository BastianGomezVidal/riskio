import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Storm } from '../../weather/storms/entities/storm.entity.js';

/**
 * One item in the history list.
 *
 * Deliberately lighter than StormSummaryDto: no forecast points, no
 * advisories, no geometry. History is a directory of storms; callers
 * that need the advisories fetch them from GET /storms/:atcfId.
 */
export class StormHistoryItemDto {
  @ApiProperty({ description: 'The storm row' })
  storm: Storm;

  @ApiProperty({
    description: 'Total number of advisories stored for this storm',
    example: 22,
  })
  advisoryCount: number;

  @ApiPropertyOptional({
    description: 'Timestamp of the feed pass that last saw this storm',
    nullable: true,
  })
  lastSeenInFeedAt: Date | null;
}
