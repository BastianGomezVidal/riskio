import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { WeatherModule } from './weather.module.js';

/**
 * Start the weather service.
 *
 * Same shape as the other extracted services: JSON logs through pino, no CORS
 * (nothing in a browser talks to it), no Swagger (internal read surface). The
 * storm and advisory controllers come from the weather domain as they are, so
 * the public surface the frontend already consumes is unchanged.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(WeatherModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  const port = Number(process.env.WEATHER_SERVICE_PORT ?? 3007);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Weather');
  logger.log(`weather service listening on ${port}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

await bootstrap();
