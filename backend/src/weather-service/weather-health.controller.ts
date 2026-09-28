import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class WeatherHealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{ status: string; database: string }> {
    // A real query, for the same reason the feeds service does one: a weather
    // service that cannot read would answer 200 and then fail every request, and
    // a readiness probe that always passes is worse than none.
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      throw new ServiceUnavailableException(
        `database not reachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { status: 'ok', database: 'reachable' };
  }
}
