import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthProxyMiddleware } from './auth-proxy.middleware.js';
import type { AuthChecker } from '../../common/authz/authz.ports.js';

const checker: AuthChecker = {
  verify: vi.fn().mockResolvedValue(undefined),
  introspect: vi.fn(),
} as unknown as AuthChecker;

function configStub(overrides: Record<string, string | number> = {}): ConfigService {
  const values: Record<string, string | number> = {
    AUTH_SERVICE_URL: 'http://backend-auth:3008',
    AUTH_SERVICE_TIMEOUT_MS: 5_000,
    ...overrides,
  };

  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

function middleware(overrides?: Record<string, string | number>) {
  return new AuthProxyMiddleware(checker, configStub(overrides));
}

/** Minimal request with no body, which is what a GET looks like. */
function get(path: string): Request {
  return {
    method: 'GET',
    originalUrl: path,
    headers: {},
    body: undefined,
  } as unknown as Request;
}

/** Records what the middleware told the response to do. */
function recorder() {
  const state = {
    status: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    ended: false,
  };

  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    setHeader(key: string, value: string) {
      state.headers[key.toLowerCase()] = value;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      state.ended = true;
      return this;
    },
    send(payload: unknown) {
      state.body = payload;
      state.ended = true;
      return this;
    },
    end() {
      state.ended = true;
      return this;
    },
  } as unknown as Response;

  return { res, state };
}

function upstream(init: {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}): Response {
  return {
    status: init.status,
    headers: {
      get: (key: string) => init.headers?.[key.toLowerCase()] ?? null,
    },
    text: async () => init.body ?? '',
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AuthProxyMiddleware', () => {
  /**
   * The regression this covers: the upstream `fetch` used to follow the OAuth
   * callback's 302 to `FRONTEND_URL` itself. In a dev setup that host only
   * exists in the host's `/etc/hosts`, so inside the container network it
   * resolved to the container's own loopback, nothing was listening, the fetch
   * threw, and the caller got `503 the auth service is unavailable` — including
   * after a completely successful sign-in.
   */
  it('passes a redirect through with its Location instead of following it', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      upstream({
        status: 302,
        headers: { location: 'http://riskio.test/auth/callback?token=abc' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { res, state } = recorder();
    await middleware().use(get('/auth/oauth/google/callback'), res, vi.fn());

    expect(state.status).toBe(302);
    expect(state.headers.location).toBe('http://riskio.test/auth/callback?token=abc');
    expect(state.body).toBeUndefined();

    /**
     * A status and a `Location` do not finish a response. Returning without
     * `end()` left the socket open until nginx's 60 s `proxy_read_timeout`
     * killed it, so the redirect was right in the logs and the browser still
     * got a gateway timeout. Nothing timed out fast enough to be obvious while
     * developing, which is why it is asserted rather than eyeballed.
     */
    expect(state.ended).toBe(true);

    // The decisive part: the proxy asked for the redirect to be handed back.
    expect(fetchSpy.mock.calls[0]?.[1]?.redirect).toBe('manual');
  });

  it('forwards a non-redirect response body and status unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        upstream({
          status: 401,
          headers: { 'content-type': 'application/json' },
          body: '{"message":"nope"}',
        }),
      ),
    );

    const { res, state } = recorder();
    await middleware().use(get('/auth/session'), res, vi.fn());

    expect(state.status).toBe(401);
    expect(state.headers['content-type']).toBe('application/json');
    expect(state.body).toBe('{"message":"nope"}');
  });

  it('answers 503 when the auth service cannot be reached at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const { res, state } = recorder();
    await middleware().use(get('/auth/session'), res, vi.fn());

    expect(state.status).toBe(503);
    expect(state.body).toMatchObject({ message: 'the auth service is unavailable' });
  });

  it('forwards the request to the configured auth service with the original path', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      upstream({ status: 200, body: '{}' }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { res } = recorder();
    await middleware().use(get('/users/me'), res, vi.fn());

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://backend-auth:3008/users/me');
  });
});
