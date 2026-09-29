import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AuthServiceModule } from './auth.module.js';

/**
 * Start the auth service.
 *
 * It owns `JWT_SECRET` and the users table, and it is the only process that
 * does. The API asks it for decisions over the `core` network and publishes no
 * port for them, so nothing outside compose can reach it.
 *
 * Unlike the storage and cache services, this one **does** need a global
 * ValidationPipe, because its bodies are DTO classes with class-validator
 * decorators rather than plain types. Those two services skip the pipe on
 * purpose: `whitelist: true` would strip every field of a plain interface and
 * reject all their requests.
 *
 * The API's own pipe does not cover these routes. `AuthProxyMiddleware` answers
 * `/auth/*` and `/users/*` before Nest routes them, so the API's pipes never
 * see a `/auth` request at all — the body just gets forwarded as JSON. That
 * left the decorators on `RegisterDto`, `CredentialsDto` and the rest
 * unevaluated, and the effect was not a cosmetic lack of 400s: `POST
 * /auth/register` with `email: "no-es-email"` returned 201 with a session token,
 * and `POST /auth/login` with the same address returned a working access token.
 * An unauthenticated caller could mint accounts on addresses that can never
 * receive a password reset. The same options as the API, so the two services
 * agree on what a valid body is.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AuthServiceModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

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
