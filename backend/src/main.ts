import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { Logger } from 'nestjs-pino';
import { buildOpenApi } from './common/openapi.js';

/**
 * Start the HTTP server.
 *
 * Responsibilities:
 *  - enforce DTO validation on every request body/query/param,
 *  - allow browser front-ends to call the API from a different origin
 *    (CORS origins come from `CORS_ORIGINS`; empty = allow all),
 *  - serve the Swagger UI at /docs and the machine-readable spec at /docs-json.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Flush the buffered logs through pino instead of Nest's console Logger.
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const configService = app.get(ConfigService);
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
  });

  /**
   * Docs for the gateway itself. `/auth/*` and `/users/*` are answered by
   * `AuthProxyMiddleware` before Nest routes them, so their controllers belong
   * to the auth service and are documented there; this document covers what
   * this process actually owns.
   */
  const document = buildOpenApi(app, {
    title: 'Riskio API (gateway)',
    tags: [
      { name: 'storms', description: 'Tropical cyclone records, filterable' },
      { name: 'advisories', description: 'Per-storm advisories, tracks and cones' },
      { name: 'dashboard', description: 'Aggregated dashboard payload' },
      { name: 'ingestion', description: 'Manual NHC ingestion triggers (admin)' },
      { name: 'health', description: 'Liveness and readiness probes' },
    ],
    description:
      'Tropical cyclone data from NOAA NHC. This process is a gateway: it owns ' +
      'the public routes, forwards them to the service that holds the data, and ' +
      'holds no domain state of its own. Storm, advisory and dashboard responses ' +
      'are streamed through untouched, so the service that owns a resource is the ' +
      'only place its shape is defined.',
  });
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { defaultModelsExpandDepth: 0 },
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
