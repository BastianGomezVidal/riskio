import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service.js';
import { STORAGE_SERVICE } from './storage.tokens.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: S3StorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
