import { ApiProperty } from '@nestjs/swagger';
import type { BasinName } from '../../../../shared/basin/basin.js';

/**
 * Counters describing the outcome of one ingestion run for a basin.
 *
 * Exposed as a class (not a plain interface) so the Swagger document can
 * render a proper response schema for the `admin/ingest` endpoints.
 */
export class IngestReportDto {
  @ApiProperty({
    description: 'Ingested ocean basin',
    enum: ['at', 'ep', 'cp'],
    example: 'ep',
  })
  basin: BasinName;

  @ApiProperty({ description: 'Storm summaries seen in the basin feed' })
  stormsSeen: number;

  @ApiProperty({ description: 'Storms upserted into the database' })
  stormsUpserted: number;

  @ApiProperty({ description: 'New advisories inserted' })
  advisoriesInserted: number;

  @ApiProperty({ description: 'Advisories already present and skipped' })
  advisoriesSkipped: number;

  @ApiProperty({ description: 'Forecast points written' })
  forecastPointsInserted: number;

  @ApiProperty({
    description: 'Advisories whose track/cone geometry was stored',
  })
  geometriesUpdated: number;

  @ApiProperty({ description: 'Coastal watch/warning segments stored' })
  warningSegments: number;

  @ApiProperty({
    description: 'Non-fatal per-storm errors collected during the run',
    type: [String],
  })
  errors: string[];
}
