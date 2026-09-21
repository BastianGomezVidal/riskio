import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Storm } from './entities/storm.entity.js';
import { StormsService } from './storms.service.js';
import { StormsController } from './storms.controller.js';

/**
 * Storms feature module: the storm aggregate and its ingestion-side
 * operations. Read models (dashboard, history) live in their own modules
 * and consume this one through TypeORM's feature registration.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Storm])],
  controllers: [StormsController],
  providers: [StormsService],
  exports: [StormsService],
})
export class StormsModule {}
