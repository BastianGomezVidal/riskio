import { ApiProperty } from '@nestjs/swagger';

/** Pagination metadata returned alongside every collection. */
export class PageMetaDto {
  @ApiProperty({ description: 'Total number of records across all pages' })
  total: number;

  @ApiProperty({ description: 'Current page number (1-indexed)' })
  page: number;

  @ApiProperty({ description: 'Number of records on this page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  pageCount: number;

  @ApiProperty({ description: 'Whether a next page exists' })
  hasNextPage: boolean;
}
