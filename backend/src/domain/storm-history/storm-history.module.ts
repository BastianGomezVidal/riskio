import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Storm } from '../weather/storms/entities/storm.entity.js';
import { Advisory } from '../weather/advisories/entities/advisory.entity.js';
import { HistoryService } from './storm-history.service.js';
import { StormHistoryController } from './storm-history.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Storm, Advisory])],
  controllers: [StormHistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
