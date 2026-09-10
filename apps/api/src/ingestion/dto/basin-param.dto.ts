import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const BASIN_NAMES = ['at', 'ep', 'cp'] as const;
export type BasinName = (typeof BASIN_NAMES)[number];

/** Route parameter identifying an ocean basin to ingest. */
export class BasinParamDto {
  @ApiProperty({ enum: BASIN_NAMES, description: 'Ocean basin to ingest' })
  @IsIn(BASIN_NAMES)
  basin: BasinName;
}
