import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../domain/auth/decorators/public.decorator.js';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * @Public() because the global guard would answer 401 before the handler ran,
 * and the container healthcheck has no bearer token to offer. The other
 * services' health endpoints work because nothing in front of them requires
 * authentication; here the service *is* the thing that authenticates, so its own
 * guard would have guarded the check that says whether it can serve at all.
 */
@Public()
@Controller('health')
export class AuthHealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{ status: string; database: string }> {
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
