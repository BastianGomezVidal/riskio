import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

/**
 * Readiness/liveness probe for the container healthcheck.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health probe (liveness & readiness)' })
  @ApiOkResponse({ description: 'Service health and DB connectivity status' })
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
