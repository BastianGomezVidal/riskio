import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from './page-meta.dto.js';

export class PaginatedResultDto<T> {
  @ApiProperty({ type: () => PageMetaDto })
  meta: PageMetaDto;

  @ApiProperty({ isArray: true })
  data: T[];

  constructor(meta: PageMetaDto, data: T[]) {
    this.meta = meta;
    this.data = data;
  }
}
