import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AuthServiceModule } from './auth.module.js';

/**
 * Start the auth service.
 *
 * It owns `JWT_SECRET` and the users table, and it is the only process that
 * does. The API asks it for decisions over the `core` network and publishes no
 * port for them, so nothing outside compose can reach it.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AuthServiceModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  const port = Number(process.env.AUTH_SERVICE_PORT ?? 3008);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Auth');
  logger.log(`auth service listening on ${port}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await bootstrap();
