import { ApiProperty } from '@nestjs/swagger';
import {
  LatestAdvisoryDto,
  StormSummaryDto,
} from '../../weather/storms/dto/storm-summary.dto.js';

// Re-export so consumers can import them from the dashboard module.
export { LatestAdvisoryDto, StormSummaryDto };

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

  @ApiProperty({
    description: 'Storms in the Pacific basin (EP + CP)',
    example: 4,
  })
  pacific: number;

  @ApiProperty({
    description: 'Storms in the Atlantic basin (AL)',
    example: 2,
  })
  atlantic: number;
}

export class DashboardSummaryDto {
  @ApiProperty({ description: 'ISO timestamp when this summary was generated' })
  generatedAt: string;

  @ApiProperty({ type: () => DashboardTotalsDto })
  totals: DashboardTotalsDto;

  @ApiProperty({ type: () => StormSummaryDto, isArray: true })
  storms: StormSummaryDto[];
}
