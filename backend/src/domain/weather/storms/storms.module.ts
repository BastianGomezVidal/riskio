import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Storm } from './entities/storm.entity.js';
import { StormsService } from './storms.service.js';
import { StormsController } from './storms.controller.js';

/**
 * Storms feature module: known tropical cyclones.
 *
 * Registers the {@link Storm} entity, exposes the
 * {@link StormsController} HTTP surface and shares
 * {@link StormsService} with the ingestion pipeline.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Storm])],
  controllers: [StormsController],
  providers: [StormsService],
  exports: [StormsService],
})
export class StormsModule {}
