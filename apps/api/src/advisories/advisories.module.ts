import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Advisory } from './entities/advisory.entity.js';
import { AdvisoriesService } from './advisories.service.js';
import { AdvisoriesController } from './advisories.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Advisory])],
  controllers: [AdvisoriesController],
  providers: [AdvisoriesService],
  exports: [AdvisoriesService],
})
export class AdvisoriesModule {}