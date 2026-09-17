import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Aggregated payload powering the frontend dashboard: season totals plus
   * every storm with its latest advisory and forecast points.
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Dashboard summary',
    description:
      'One payload with season totals and per-storm latest-advisory data. ' +
      'Designed to replace N+1 storm → advisory → points requests from the frontend.',
  })
  @ApiOkResponse({
    description: 'Dashboard summary.',
    type: DashboardSummaryDto,
  })
  getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }
}
