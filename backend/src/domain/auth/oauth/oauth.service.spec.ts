import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OAuthService, OAuthProviderName } from './oauth.service.js';

function configStub(
  overrides: Record<string, string | number> = {},
): ConfigService {
  const values: Record<string, string | number> = {
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    MICROSOFT_CLIENT_ID: 'ms-id',
    MICROSOFT_CLIENT_SECRET: 'ms-secret',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    ...overrides,
  };

  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

function stubFetch(
  responder: (url: string, init?: RequestInit) => Promise<unknown>,
) {
  const spy = vi.fn(responder);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OAuthService', () => {
  describe('buildAuthorizeUrl', () => {
    it('builds a Google consent URL with the configured credentials', () => {
      const service = new OAuthService(configStub());

      const url = service.buildAuthorizeUrl(OAuthProviderName.Google);
      const parsed = new URL(url);

      expect(parsed.origin).toBe('https://accounts.google.com');
      expect(parsed.searchParams.get('client_id')).toBe('google-id');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toContain('openid');
      expect(parsed.searchParams.get('state')).toHaveLength(32);
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/api/auth/oauth/google/callback',
      );
    });

    it('builds an Outlook consent URL on the Microsoft common endpoint', () => {
      const service = new OAuthService(configStub());

      const url = service.buildAuthorizeUrl(OAuthProviderName.Outlook);

      expect(url).toContain(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      );
      expect(url).toContain('client_id=ms-id');
      expect(url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Foauth%2Foutlook%2Fcallback',
      );
    });

    /**
     * These two are the regression tests for a callback URL that was wrong in
     * two ways at once, and that a test had been asserting as correct: the
     * origin pointed at the gateway's internal port instead of the nginx that
     * the browser can actually reach, and the `/api` prefix was missing even
     * though that is the only path the API is served on. Google and Microsoft
     * reject that as `redirect_uri_mismatch`, after the user has already
     * authenticated and consented.
     */
    it('uses API_PUBLIC_BASE_URL verbatim when it is set', () => {
      const service = new OAuthService(
        configStub({
          PUBLIC_BASE_URL: 'http://localhost:3000',
          API_PUBLIC_BASE_URL: 'https://riskio.example.com/api',
        }),
      );

      expect(
        new URL(
          service.buildAuthorizeUrl(OAuthProviderName.Google),
        ).searchParams.get('redirect_uri'),
      ).toBe('https://riskio.example.com/api/auth/oauth/google/callback');
    });

    it('derives the /api prefix from PUBLIC_BASE_URL and tolerates trailing slashes', () => {
      const service = new OAuthService(
        configStub({ PUBLIC_BASE_URL: 'https://riskio.example.com/' }),
      );

      expect(
        new URL(
          service.buildAuthorizeUrl(OAuthProviderName.Google),
        ).searchParams.get('redirect_uri'),
      ).toBe('https://riskio.example.com/api/auth/oauth/google/callback');
    });

    it('sends the same redirect_uri in the consent URL and the token exchange', async () => {
      const fetchSpy = stubFetch(async (url) => {
        if (String(url).includes('token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'at' }),
          } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({ email: 'a@b.co' }),
        } as unknown as Response;
      });

      const service = new OAuthService(configStub());
      const consent = new URL(
        service.buildAuthorizeUrl(OAuthProviderName.Google),
      );
      const state = consent.searchParams.get('state') as string;

      await service.exchangeIdentity(OAuthProviderName.Google, 'code', state);

      const exchangeBody = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams;
      expect(exchangeBody.get('redirect_uri')).toBe(
        consent.searchParams.get('redirect_uri'),
      );
    });
  });

  describe('exchangeIdentity', () => {
    it('rejects an unknown or expired state', async () => {
      const service = new OAuthService(configStub());

      await expect(
        service.exchangeIdentity(
          OAuthProviderName.Google,
          'code',
          'forged-state',
        ),
      ).rejects.toThrow('Invalid or expired OAuth state');
    });

    it('exchanges the code and maps the provider profile to identity fields', async () => {
      const service = new OAuthService(configStub());
      const authorizeUrl = service.buildAuthorizeUrl(OAuthProviderName.Google);
      const state = new URL(authorizeUrl).searchParams.get('state')!;

      const fetchSpy = stubFetch(async (url: string, init?: RequestInit) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          expect(init?.method).toBe('POST');
          const body = String(init?.body);
          expect(body).toContain('grant_type=authorization_code');
          expect(body).toContain('code=the-code');
          return new Response(JSON.stringify({ access_token: 'at-123' }), {
            status: 200,
          });
        }

        if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
          expect(init?.headers).toMatchObject({
            Authorization: 'Bearer at-123',
          });
          return new Response(
            JSON.stringify({
              email: 'ada@example.com',
              given_name: 'Ada',
              family_name: 'Lovelace',
            }),
            { status: 200 },
          );
        }

        return new Response('not found', { status: 404 });
      });

      const profile = await service.exchangeIdentity(
        OAuthProviderName.Google,
        'the-code',
        state,
      );

      expect(profile).toEqual({
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('supports Microsoft profile shape (name only, optional family name)', async () => {
      const service = new OAuthService(configStub());
      const url = service.buildAuthorizeUrl(OAuthProviderName.Outlook);
      const state = new URL(url).searchParams.get('state')!;

      stubFetch(async (target: string) => {
        if (
          target ===
          'https://login.microsoftonline.com/common/oauth2/v2.0/token'
        ) {
          return new Response(JSON.stringify({ access_token: 'at-ms' }), {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({ email: 'grace@example.com', name: 'Grace Hopper' }),
          { status: 200 },
        );
      });

      const profile = await service.exchangeIdentity(
        OAuthProviderName.Outlook,
        'code-1',
        state,
      );

      expect(profile).toEqual({
        email: 'grace@example.com',
        firstName: 'Grace Hopper',
        lastName: null,
      });
    });

    it('fails when the profile does not expose an email', async () => {
      const service = new OAuthService(configStub());
      const url = service.buildAuthorizeUrl(OAuthProviderName.Google);
      const state = new URL(url).searchParams.get('state')!;

      stubFetch(async (target: string) => {
        if (target === 'https://oauth2.googleapis.com/token') {
          return new Response(JSON.stringify({ access_token: 'at' }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ given_name: 'No' }), {
          status: 200,
        });
      });

      await expect(
        service.exchangeIdentity(OAuthProviderName.Google, 'code', state),
      ).rejects.toThrow('does not expose an email');
    });
  });

  describe('isConfigured', () => {
    it('is false when client credentials are blank', () => {
      const service = new OAuthService(
        configStub({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }),
      );

      expect(service.isConfigured(OAuthProviderName.Google)).toBe(false);
      expect(service.isConfigured(OAuthProviderName.Outlook)).toBe(true);
    });
  });
});
