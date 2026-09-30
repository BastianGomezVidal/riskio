import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import {
  AUTH_CHECKER,
  type AuthChecker,
} from '../../common/authz/authz.ports.js';

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
 *
 * Bodies are forwarded, but not uniformly, and the difference matters.
 * `express.json()` fills `req.body` for `application/json` and leaves the
 * stream alone for everything else, so for multipart `req.body` is `undefined`
 * while the bytes are still sitting on the request. Forwarding
 * `JSON.stringify(req.body)` therefore sent the `content-type` header, boundary
 * included, and no body at all: the auth service ran busboy over an empty
 * stream and answered `400 Multipart: Unexpected end of form` for every avatar
 * upload. `POST /users/me/avatar` was unreachable, and it was not nginx's
 * doing — the same request failed identically straight against the API.
 *
 * So anything that is not JSON is read off the stream and forwarded as bytes.
 */
@Injectable()
export class AuthProxyMiddleware implements NestMiddleware {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  /**
   * Ceiling for a non-JSON body buffered here. nginx already refuses anything
   * over 2 MB with `client_max_body_size`, and multer caps the avatar at the
   * same 2 MB, so this is not a limit the app relies on. It exists because a
   * middleware that concatenates chunks onto its own heap is a memory
   * amplification point if a future caller reaches the API without nginx in
   * front, and answering 413 is better than an out-of-memory kill.
   */
  private static readonly MAX_RAW_BODY_BYTES = 2 * 1024 * 1024;

  constructor(
    @Inject(AUTH_CHECKER) private readonly checker: AuthChecker,
    config: ConfigService,
  ) {
    this.baseUrl = config
      .get<string>('AUTH_SERVICE_URL', 'http://backend-auth:3008')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get('AUTH_SERVICE_TIMEOUT_MS', 5_000));
  }

  /**
   * The body to forward, or `undefined` when there is none.
   *
   * An `ArrayBuffer` for a non-JSON body so fetch sends the bytes and sets
   * `content-length` from them. Forwarding the header the client sent instead
   * would be a way to reintroduce the very mismatch being fixed.
   *
   * `ArrayBuffer` rather than `Buffer`: the `BodyInit` that applies here comes
   * from lib.dom, which does not accept Node's `Buffer` even though the two
   * carry identical bytes. `Buffer.concat` can hand back a slice of a shared
   * pool, so the bytes are copied out rather than aliased.
   */
  private async readBody(
    req: Request,
  ): Promise<ArrayBuffer | string | undefined> {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return undefined;
    }
    if (req.body !== undefined) {
      return JSON.stringify(req.body);
    }
    if (req.readableEnded) {
      return undefined;
    }
    return this.readRawBody(req);
  }

  private readRawBody(req: Request): Promise<ArrayBuffer | undefined> {
    const limit = AuthProxyMiddleware.MAX_RAW_BODY_BYTES;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let refused = false;
      req.on('data', (chunk: Buffer) => {
        if (refused) {
          return;
        }
        total += chunk.length;
        if (total > limit) {
          refused = true;
          const error = new Error('Request body too large');
          Object.assign(error, { status: 413 });
          /**
           * Pause, do not destroy. Destroying the socket is what made this
           * unanswerable: the client saw the 100 Continue and then a dead
           * connection instead of the 413 the caller is about to write. Pausing
           * stops the heap from growing while the rest of the upload stays in
           * the socket, and the response below still gets out.
           */
          req.pause();
          reject(error);
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (!refused) {
          const joined = Buffer.concat(chunks);
          resolve(
            joined.buffer.slice(
              joined.byteOffset,
              joined.byteOffset + joined.byteLength,
            ),
          );
        }
      });
      req.on('error', (error) => {
        if (!refused) {
          reject(error);
        }
      });
    });
  }

  async use(req: Request, res: Response, _next: NextFunction): Promise<void> {
    // A repeated content-type arrives as an array; take the first, which is the
    // one a body parser would have used.
    const contentType = req.headers['content-type'];
    const headers: Record<string, string> = {
      'content-type':
        (Array.isArray(contentType) ? contentType[0] : contentType) ??
        'application/json',
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

    let body: ArrayBuffer | string | undefined;
    try {
      body = await this.readBody(req);
    } catch (error) {
      // Only the size ceiling reaches here. It has to be answered before the
      // fetch, because the auth service would be handed a truncated body and
      // report it as malformed rather than as too large. The connection is
      // closed because the request body was never read to the end, and the
      // client is most likely still uploading.
      const status = (error as { status?: number }).status ?? 413;
      res.setHeader('connection', 'close').status(status).json({
        statusCode: status,
        error: 'Payload Too Large',
        message: 'the request body is too large',
      });
      return;
    }

    try {
      const upstream = await fetch(`${this.baseUrl}${req.originalUrl}`, {
        method: req.method,
        headers,
        /**
         * A GET has no body and that is fine; forwarding `undefined` is what
         * a real GET looks like. An earlier version skipped the whole
         * request when `req.body` was undefined, which is every GET and
         * every DELETE, so `/users/me` and `/auth/tokens` fell through to
         * Nest's own 404 and looked like missing endpoints.
         */
        body,
        /**
         * `manual`, and it matters for the OAuth callback.
         *
         * `/auth/oauth/:provider/callback` answers with a 302 to
         * `FRONTEND_URL`, because that is how the user gets back to the SPA
         * with their token. Left on the default, this `fetch` followed that
         * 302 itself and tried to resolve `FRONTEND_URL` from inside the
         * container network. A dev host that only exists in the host's
         * `/etc/hosts` resolves there to the container's own loopback,
         * where nothing is listening, so the fetch threw and every OAuth
         * callback — including a fully successful one — surfaced as
         * "the auth service is unavailable".
         *
         * The redirect is not this proxy's to follow. It is addressed to the
         * browser, which is the only party that can resolve it, so it is
         * passed straight through with its `Location`.
         */
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      /**
       * A redirect has no body worth forwarding, and `text()` on one can only
       * ever be the framework's "moved permanently" page. Send the status and
       * the `Location` and let the browser go.
       *
       * The `end()` is load-bearing. Setting a status and a header does not
       * finish a response, and returning without sending one left the socket
       * open until nginx's `proxy_read_timeout` killed the request 60 seconds
       * later: the redirect was correct in the logs and the browser still saw
       * a gateway timeout.
       */
      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (location) {
          res.setHeader('location', location);
        }
        res.status(upstream.status).end();
        return;
      }

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
