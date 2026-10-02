import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';

/** Supported OAuth identity providers. */
export enum OAuthProviderName {
  Google = 'google',
  Outlook = 'outlook',
}

/** Normalized identity fields resolved from an OAuth provider profile. */
export interface OAuthProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface ProviderDefinition {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
}

/** Pending OAuth authorization saved to validate the callback `state`. */
interface PendingState {
  provider: OAuthProviderName;
  expiresAt: number;
}

const PROVIDERS: Record<OAuthProviderName, ProviderDefinition> = {
  [OAuthProviderName.Google]: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'openid email profile',
  },
  [OAuthProviderName.Outlook]: {
    authorizeUrl:
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile',
  },
};

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * OAuth 2.0 authorization-code flow for Google and Microsoft (Outlook).
 *
 * Uses plain `fetch` against the well-known endpoints; no passport or
 * provider SDKs. The authorization `state` is kept in a short-lived in-memory
 * map to bind each callback to a previously issued request.
 */
@Injectable()
export class OAuthService {
  private readonly clientIds: Record<OAuthProviderName, string>;
  private readonly clientSecrets: Record<OAuthProviderName, string>;
  private readonly apiPublicBase: string;
  private readonly timeoutMs: number;
  private readonly pendingStates = new Map<string, PendingState>();

  constructor(config: ConfigService) {
    this.timeoutMs = Number(config.get('OAUTH_TIMEOUT_MS', 10_000));
    this.clientIds = {
      [OAuthProviderName.Google]: config.get<string>('GOOGLE_CLIENT_ID', ''),
      [OAuthProviderName.Outlook]: config.get<string>(
        'MICROSOFT_CLIENT_ID',
        '',
      ),
    };
    this.clientSecrets = {
      [OAuthProviderName.Google]: config.get<string>(
        'GOOGLE_CLIENT_SECRET',
        '',
      ),
      [OAuthProviderName.Outlook]: config.get<string>(
        'MICROSOFT_CLIENT_SECRET',
        '',
      ),
    };

    // The callback has to be the URL the provider will actually reach, which is
    // the nginx that serves the SPA with the `/api` prefix still on it. Using the
    // bare origin produced `http://host:3000/auth/oauth/<p>/callback`, which is
    // neither publicly routed nor prefixed, and Google and Microsoft both reject
    // that as `redirect_uri_mismatch` — after the user had already signed in and
    // consented, which is the worst place to fail.
    const publicOrigin = config
      .get<string>('PUBLIC_BASE_URL', '')
      .replace(/\/+$/, '');
    const apiBase = config.get<string>('API_PUBLIC_BASE_URL', '').trim();
    this.apiPublicBase = (apiBase || `${publicOrigin}/api`).replace(/\/+$/, '');
  }

  /** Whether the provider has credentials configured. */
  isConfigured(provider: OAuthProviderName): boolean {
    return (
      this.clientIds[provider].length > 0 &&
      this.clientSecrets[provider].length > 0
    );
  }

  /**
   * Build the provider's consent URL for a new authorization request.
   *
   * Registers a `state` token so the matching callback can be validated.
   *
   * @param provider google or outlook.
   * @returns the URL the browser should be redirected to.
   */
  buildAuthorizeUrl(provider: OAuthProviderName): string {
    const state = randomBytes(16).toString('hex');
    const definition = PROVIDERS[provider];

    this.pendingStates.set(state, {
      provider,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    const redirectUri = this.redirectUri(provider);
    const params = new URLSearchParams({
      client_id: this.clientIds[provider],
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: definition.scope,
      state,
      prompt: 'select_account',
    });

    return `${definition.authorizeUrl}?${params.toString()}`;
  }

  /**
   * Validate the callback `state`, exchange the `code` for a token and fetch
   * the provider profile.
   *
   * @param provider google or outlook.
   * @param code authorization code from the callback.
   * @param state state echoed back by the provider.
   * @throws Error on invalid state, misconfigured credentials or upstream errors.
   */
  async exchangeIdentity(
    provider: OAuthProviderName,
    code: string,
    state: string,
  ): Promise<OAuthProfile> {
    const pending = this.pendingStates.get(state);

    if (
      !pending ||
      pending.provider !== provider ||
      pending.expiresAt < Date.now()
    ) {
      throw new Error('Invalid or expired OAuth state');
    }

    this.pendingStates.delete(state);

    const accessToken = await this.exchangeCode(provider, code);
    const profile = await this.fetchProfile(provider, accessToken);

    return {
      email: profile.email,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
    };
  }

  /**
   * The `redirect_uri` for a provider, sent both in the consent URL and in the
   * token exchange. It must be byte-identical in both, and identical to the URL
   * registered with the provider, or the exchange is rejected.
   */
  private redirectUri(provider: OAuthProviderName): string {
    return `${this.apiPublicBase}/auth/oauth/${provider}/callback`;
  }

  private async exchangeCode(
    provider: OAuthProviderName,
    code: string,
  ): Promise<string> {
    const definition = PROVIDERS[provider];

    const response = await fetch(definition.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientIds[provider],
        client_secret: this.clientSecrets[provider],
        code,
        redirect_uri: this.redirectUri(provider),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OAuth ${provider} token exchange failed (${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as { access_token?: string };

    if (!json.access_token) {
      throw new Error(`OAuth ${provider} token exchange missing access_token`);
    }

    return json.access_token;
  }

  private async fetchProfile(
    provider: OAuthProviderName,
    accessToken: string,
  ): Promise<OAuthProfile> {
    const definition = PROVIDERS[provider];

    const response = await fetch(definition.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `OAuth ${provider} profile fetch failed (${response.status})`,
      );
    }

    const json = (await response.json()) as {
      email?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
    };

    if (!json.email) {
      throw new Error(`OAuth ${provider} profile does not expose an email`);
    }

    const firstName = json.given_name ?? json.name ?? null;
    const lastName = json.family_name ?? null;

    return { email: json.email, firstName, lastName };
  }
}
