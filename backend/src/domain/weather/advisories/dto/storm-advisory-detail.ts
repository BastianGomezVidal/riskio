import { ApiProperty } from '@nestjs/swagger';
import { StormDto } from '../../storms/dto/storm.dto.js';
import { AdvisoryDetailDto } from './advisory-detail.dto.js';

/**
 * Composite response for GET /storms/:atcfId/advisories/:n.
 *
 * Combines the storm context (for breadcrumb and header) with the full
 * advisory detail (forecast points, warnings, track, cone).
 *
 * The storm part is a reduced view — `advisories[]` is intentionally
 * omitted, since the user is already viewing one specific advisory.
 */
export class StormAdvisoryDetailDto {
  @ApiProperty({
    description: 'Storm context for the current advisory view',
    type: () => StormDto,
  })
  storm: StormDto;

  @ApiProperty({
    description: 'Full advisory detail',
    type: () => AdvisoryDetailDto,
  })
  advisory: AdvisoryDetailDto;
}
