import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DashboardServiceModule } from './dashboard.module.js';

/**
 * Start the dashboard service.
 *
 * Same shape as the other extracted services: JSON logs through pino, no CORS,
 * and the health endpoint is public because the container healthcheck has no
 * bearer token to offer.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(DashboardServiceModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));

  const port = Number(process.env.DASHBOARD_SERVICE_PORT ?? 3009);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Dashboard');
  logger.log(`dashboard service listening on ${port}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await bootstrap();
