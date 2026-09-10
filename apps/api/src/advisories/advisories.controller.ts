import { Controller, Get, Param } from '@nestjs/common';
import { AdvisoriesService } from './advisories.service.js';
import { Advisory } from './entities/advisory.entity.js';

@Controller()
export class AdvisoriesController {
  constructor(private readonly advisoriesService: AdvisoriesService) {}

  @Get('storms/:atcfId/advisories')
  findByStorm(@Param('atcfId') atcfId: string): Promise<Advisory[]> {
    return this.advisoriesService.findByStorm(atcfId);
  }

  @Get('advisories/:id')
  findOne(@Param('id') id: string): Promise<Advisory> {
    return this.advisoriesService.findOne(id);
  }
}
