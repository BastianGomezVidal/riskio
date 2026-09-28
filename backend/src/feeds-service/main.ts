import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { FeedsModule } from './feeds.module.js';

/**
 * Start the feeds service.
 *
 * Same shape as the storage and cache services: JSON logs through pino, no
 * CORS (nothing in a browser talks to it), no Swagger (an internal contract).
 * Unlike those two, it exposes trigger endpoints, because the API's
 * `admin/ingest/*` has to reach the ingestion from somewhere and this is where
 * the ingestion now lives.
 *
 * The cron is armed here and only here, so every basin is polled once per
 * interval instead of twice.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(FeedsModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  const port = Number(process.env.FEEDS_SERVICE_PORT ?? 3006);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Feeds');
  logger.log(`feeds service listening on ${port}; NHC polling every 10 minutes`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await bootstrap();
