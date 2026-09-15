import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from './page-meta.dto.js';

/** Generic paginated envelope: page metadata plus the records for it. */
export class PaginatedResultDto<T> {
  @ApiProperty({ description: 'Page metadata' })
  meta: PageMetaDto;

  @ApiProperty({ description: 'Records on this page' })
  data: T[];

  constructor(meta: PageMetaDto, data: T[]) {
    this.meta = meta;
    this.data = data;
  }
}
