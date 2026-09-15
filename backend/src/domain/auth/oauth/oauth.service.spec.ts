import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  OAuthService,
  OAuthProviderName,
} from './oauth.service.js';

function configStub(overrides: Record<string, string | number> = {}): ConfigService {
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

function stubFetch(responder: (url: string, init?: RequestInit) => Promise<unknown>) {
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
        'http://localhost:3000/auth/oauth/google/callback',
      );
    });

    it('builds an Outlook consent URL on the Microsoft common endpoint', () => {
      const service = new OAuthService(configStub());

      const url = service.buildAuthorizeUrl(OAuthProviderName.Outlook);

      expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url).toContain('client_id=ms-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Foauth%2Foutlook%2Fcallback');
    });
  });

  describe('exchangeIdentity', () => {
    it('rejects an unknown or expired state', async () => {
      const service = new OAuthService(configStub());

      await expect(
        service.exchangeIdentity(OAuthProviderName.Google, 'code', 'forged-state'),
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
        if (target === 'https://login.microsoftonline.com/common/oauth2/v2.0/token') {
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
        return new Response(JSON.stringify({ given_name: 'No' }), { status: 200 });
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