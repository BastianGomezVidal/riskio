import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BASIN_NAMES } from '../../../../shared/basin/basin.js';
import type { BasinName } from '../../../../shared/basin/basin.js';

export class BasinParamDto {
  @ApiProperty({
    enum: BASIN_NAMES,
    description: 'Ocean basin to ingest',
    example: 'ep',
  })
  @IsIn(BASIN_NAMES)
  basin: BasinName;
}
