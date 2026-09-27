import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StormSort, StormTab } from '../utils/storm-enums.js';

export class StormListQueryDto {
  @ApiPropertyOptional({ enum: StormTab, default: StormTab.Active })
  @IsOptional()
  @IsEnum(StormTab)
  tab?: StormTab = StormTab.Active;

  @ApiPropertyOptional({ description: 'Search by name or ATCF id' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: StormSort, default: StormSort.Newest })
  @IsOptional()
  @IsEnum(StormSort)
  sort?: StormSort = StormSort.Newest;

  @ApiPropertyOptional({
    description: 'Comma-separated basin codes (EP, AL, CP)',
    example: 'EP,AL',
  })
  @IsOptional()
  @IsString()
  basin?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated categories (0-5)',
    example: '3,4,5',
  })
  @IsOptional()
  @IsString()
  cat?: string;

  @ApiPropertyOptional({ description: 'Filter from this year (inclusive)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearFrom?: number;

  @ApiPropertyOptional({ description: 'Filter up to this year (inclusive)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearTo?: number;
}
