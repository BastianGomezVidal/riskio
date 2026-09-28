import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { Logger } from '@nestjs/common';
import { CacheAppModule } from './app.module.js';

/**
 * Start the cache service.
 *
 * Same shape as the storage service: JSON logs through pino, no CORS (nothing
 * in a browser talks to it), no Swagger (internal contract, not a published
 * API), and no global ValidationPipe (its bodies are plain types, so
 * `whitelist: true` would strip every field).
 *
 * One difference that is not cosmetic: the API does not wait for this service
 * to be healthy before starting. A cache outage has to degrade the application,
 * not prevent it from running, and a `depends_on` health condition would do the
 * opposite — the API would sit down for as long as Redis was unhappy, which is
 * the exact failure this service was extracted to remove.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(CacheAppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  const port = Number(process.env.CACHE_SERVICE_PORT ?? 3005);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Cache');
  logger.log(`cache service listening on ${port}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await bootstrap();
