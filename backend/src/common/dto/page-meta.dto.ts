import { ApiProperty } from '@nestjs/swagger';

export class PageMetaDto {
  @ApiProperty({ description: 'Total items across all pages' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  pageCount: number;

  @ApiProperty({ description: 'Whether a next page exists' })
  hasNextPage: boolean;
}
