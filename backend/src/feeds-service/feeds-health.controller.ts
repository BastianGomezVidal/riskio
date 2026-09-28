import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class FeedsHealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{ status: string; database: string }> {
    // A real query, because a feeds service that cannot reach the database
    // accepts trigger requests and then writes nothing. The API waits for this
    // to be healthy, so a silent failure here would mean a green stack that
    // ingests nothing.
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: 'reachable' };
  }
}
