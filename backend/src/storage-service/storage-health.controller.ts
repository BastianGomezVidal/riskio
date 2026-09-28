import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service.js';

/**
 * Liveness and readiness for the storage service.
 *
 * Readiness talks to the bucket instead of returning a constant, because the
 * failure worth catching is the one where the process is up, the port answers,
 * and every upload it accepts would then fail. A `depends_on` condition that
 * only checked the process would happily start the API against a storage
 * service that cannot store anything.
 *
 * Injects the concrete class rather than the `StorageService` interface: the
 * interface is the four-operation wire contract that the API implements over
 * HTTP, and bucket reachability is not one of those operations. Widening the
 * interface for a health check would force the HTTP client to fake it.
 */
@Controller('health')
export class StorageHealthController {
  constructor(private readonly s3: S3StorageService) {}

  @Get()
  async check(): Promise<{ status: string; bucket: string }> {
    try {
      await this.s3.assertBucketReachable();
    } catch (error) {
      throw new ServiceUnavailableException(
        `bucket not reachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { status: 'ok', bucket: this.s3.bucketName() };
  }
}
