import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApi } from '../common/openapi.js';
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

  /**
   * These endpoints are the ones the browser authenticates against, and they
   * cannot be documented from the API: `AuthProxyMiddleware` answers `/auth/*`
   * and `/users/*` before Nest routes them, so the API never introspects these
   * controllers. Its bearer scheme used to point at a `POST /auth/login` that
   * was not in the document at all.
   *
   * Served on the loopback-mapped port only, so it is a local reference rather
   * than a second public surface. The browser still reaches these paths through
   * the API.
   */
  const document = buildOpenApi(app, {
    title: 'Riskio API (auth)',
    tags: [
      { name: 'auth', description: 'Registration, login, password reset, OAuth entry' },
      { name: 'users', description: 'The signed-in profile, including the avatar' },
      { name: 'health', description: 'Liveness and readiness probes' },
    ],
    /**
     * `/internal/*` is how the API asks this service for a decision over the
     * compose network. It is not part of the contract the browser sees, and
     * `POST /internal/auth/check` answers "is this token valid, and who is it"
     * — not something to advertise.
     */
    excludePaths: ['/internal'],
    description:
      'Accounts, sessions and the profile. Owned by the auth service, which ' +
      'holds `JWT_SECRET` and the users table. The browser calls these paths on ' +
      'the API origin; the API forwards them here before its own router runs.',
  });
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { defaultModelsExpandDepth: 0 },
  });

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
