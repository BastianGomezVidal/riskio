import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../domain/auth/decorators/public.decorator.js';

/**
 * Readiness/liveness probe for the container healthcheck.
 *
 * Public: the Docker healthcheck runs without a JWT.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /**
   * Liveness + readiness probe: returns `ok` when the database is reachable.
   */
  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health probe (liveness & readiness)' })
  @ApiOkResponse({ description: 'Service health and DB connectivity status' })
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
