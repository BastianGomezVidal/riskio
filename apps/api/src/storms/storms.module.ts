import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Storm } from './entities/storm.entity.js';
import { StormsService } from './storms.service.js';
import { StormsController } from './storms.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Storm])],
  controllers: [StormsController],
  providers: [StormsService],
  exports: [StormsService],
})
export class StormsModule {}
