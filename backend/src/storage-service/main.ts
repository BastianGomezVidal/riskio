import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { Logger } from '@nestjs/common';
import { StorageAppModule } from './app.module.js';

/**
 * Start the storage service.
 *
 * Three things it deliberately does not do, each of which is a decision rather
 * than an omission:
 *
 *  - No CORS. Nothing in a browser talks to this service; the API does, from
 *    inside the `core` network. Leaving CORS off means a compromised page in a
 *    browser cannot reach it even if it learns the address.
 *  - No Swagger. It is an internal contract, not a published API, and an
 *    internal surface should not be documented where it invites callers.
 *  - No ValidationPipe. Its body is a plain interface rather than a DTO class,
 *    so `whitelist: true` would strip every field and reject all uploads. The
 *    controller validates explicitly instead, which also lets it reject
 *    base64 that decodes to nothing with a message that says why.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(StorageAppModule, { bufferLogs: true });

  // Same JSON log pipeline as the API and the worker, so lines from all three
  // land in Loki with the same shape and the same trace correlation.
  app.useLogger(app.get(PinoLogger));

  const port = Number(process.env.STORAGE_API_PORT ?? 3004);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Storage');
  logger.log(`storage service listening on ${port}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await bootstrap();
