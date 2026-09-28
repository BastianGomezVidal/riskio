import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { storageEnvValidationSchema } from '../config/env.validation.js';
import { StorageController } from './storage.controller.js';
import { StorageHealthController } from './storage-health.controller.js';
import { ObservabilityModule } from '../config/observability.module.js';
import { S3StorageService } from './s3-storage.service.js';
import { STORAGE_SERVICE } from '../domain/storage/storage.tokens.js';

/**
 * The storage service, on its own.
 *
 * This is the point of the extraction: the S3 credentials, the bucket policy
 * and the knowledge of how a public URL is shaped live here and nowhere else.
 * The API used to import all of that, which meant a compromised API had the
 * storage keys and that every future storage decision was a change to the
 * biggest module in the codebase.
 *
 * Deliberately not importing AppModule. That would drag in TypeORM, the auth
 * module and every domain service, and this service would go on starting a
 * database connection it has no use for.
 *
 * The env schema is a subset: the full schema requires the database and JWT
 * settings, none of which exist here on purpose.
 */
@Module({
  imports: [
    // Same JSON logging as the API and the worker, so its lines reach Loki with
    // the same shape and the same trace correlation.
    ObservabilityModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: storageEnvValidationSchema,
      expandVariables: true,
    }),
  ],
  controllers: [StorageController, StorageHealthController],
  providers: [
    // Registered as a class and aliased to the token, rather than bound twice.
    // The health controller needs the concrete class (bucket reachability is
    // not one of the three wire operations) and the controller needs the
    // token. `useExisting` gives both the *same* instance, so there is one S3
    // client and one connection pool, not two.
    S3StorageService,
    { provide: STORAGE_SERVICE, useExisting: S3StorageService },
  ],
})
export class StorageAppModule {}
