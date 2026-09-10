import { Controller, Get, Param } from '@nestjs/common';
import { StormsService } from './storms.service.js';
import { Storm } from './entities/storm.entity.js';

@Controller('storms')
export class StormsController {
  constructor(private readonly stormsService: StormsService) {}

  @Get()
  findAll(): Promise<Storm[]> {
    return this.stormsService.findAll();
  }

  @Get(':atcfId')
  findOne(@Param('atcfId') atcfId: string): Promise<Storm> {
    return this.stormsService.findOne(atcfId);
  }
}
