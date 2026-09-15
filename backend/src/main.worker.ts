import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

/**
 * Start the ingestion worker (no HTTP listener).
 *
 * Bootstraps the same {@link AppModule} as a Nest application context so the
 * scheduled NHC ingestion runs on its own process. This is the entry point
 * used by the `backend-worker` container: the scheduler keeps polling NHC
 * feeds even if the HTTP API container restarts.
 */
async function bootstrapWorker(): Promise<void> {
  const logger = new Logger('Worker');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  logger.log('ingestion worker started: NHC polling scheduler is live');

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await bootstrapWorker();