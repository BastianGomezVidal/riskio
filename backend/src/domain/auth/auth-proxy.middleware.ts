import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_CHECKER, type AuthChecker } from '../../common/authz/authz.ports.js';

/**
 * Forwards `/auth/*` and `/users/*` to the auth service.
 *
 * A middleware rather than a controller, for one reason: a proxy has to match
 * a path prefix with anything after it, and Nest's controller routing needs a
 * wildcard declared per path. Express mounts that in a line, and the handler
 * shape is the same as any other middleware.
 *
 * Two things happen here that a plain reverse proxy would not do:
 *
 * - **The principal is resolved before forwarding**, and passed on as a header.
 *   Otherwise the auth service would get a request whose credential is in a
 *   body it has to interpret, and every proxied route would arrive
 *   unauthenticated. It checks the header again against its own state, which is
 *   local and cheap, so the decision is never taken on a proxy's word.
 * - **A rejection keeps its reason.** "Your session was closed because you
 *   signed in elsewhere" survives the hop instead of becoming a flat 401.
 */
@Injectable()
export class AuthProxyMiddleware implements NestMiddleware {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(AUTH_CHECKER) private readonly checker: AuthChecker,
    config: ConfigService,
  ) {
    this.baseUrl = config
      .get<string>('AUTH_SERVICE_URL', 'http://backend-auth:3008')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get('AUTH_SERVICE_TIMEOUT_MS', 5_000));
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // A repeated content-type arrives as an array; take the first, which is the
    // one a body parser would have used.
    const contentType = req.headers['content-type'];
    const headers: Record<string, string> = {
      'content-type': (Array.isArray(contentType) ? contentType[0] : contentType) ?? 'application/json',
    };

    const authorization = req.headers.authorization ?? '';
    if (authorization.startsWith('Bearer ')) {
      /**
       * The token goes on to the auth service as well as being checked here.
       *
       * Without it the service answers 401: its own global guard runs, and a
       * request arriving with a `x-forwarded-principal` header and no
       * Authorization looks exactly like an unauthenticated one. The cost is a
       * second verification, and what it buys is a service that is not
       * defenseless if anything else ever reaches the network — the principal
       * header is a convenience, never a substitute for the credential.
       */
      headers['authorization'] = authorization;
      try {
        const principal = await this.checker.check(authorization.slice(7));
        headers['x-forwarded-principal'] = JSON.stringify(principal);
      } catch (error) {
        res.status(401).json({
          statusCode: 401,
          error: 'Unauthorized',
          message: error instanceof Error ? error.message : 'Unauthorized',
        });
        return;
      }
    }

    const apiKey = req.headers['x-api-key'];
    const apiKeyValue = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    if (apiKeyValue) {
      headers['x-api-key'] = apiKeyValue;
    }

    try {
      const upstream = await fetch(
        `${this.baseUrl}${req.originalUrl}`,
        {
          method: req.method,
          headers,
          /**
           * A GET has no body and that is fine; forwarding `undefined` is what
           * a real GET looks like. An earlier version skipped the whole
           * request when `req.body` was undefined, which is every GET and
           * every DELETE, so `/users/me` and `/auth/tokens` fell through to
           * Nest's own 404 and looked like missing endpoints.
           */
          body:
            req.method === 'GET' || req.method === 'HEAD' || req.body === undefined
              ? undefined
              : JSON.stringify(req.body),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );

      const text = await upstream.text();
      res
        .status(upstream.status)
        .setHeader(
          'content-type',
          upstream.headers.get('content-type') ?? 'application/json',
        )
        .send(text);
    } catch {
      /**
       * 503 rather than 401: the caller is probably fine and what is down is
       * the service that would have said so. Answering 401 here would log every
       * user out every time the auth service hiccups.
       */
      res.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'the auth service is unavailable',
      });
    }
  }
}
