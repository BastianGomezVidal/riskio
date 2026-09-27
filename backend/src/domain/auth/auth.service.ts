// src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity.js';
import { ApiToken } from './entities/api-token.entity.js';
import {
  generateApiToken,
  generateTemporaryPassword,
  hashToken,
} from './auth.utils.js';
import { AuthResponseDto } from './dto/credentials.dto.js';
import { ForgotPasswordResponseDto } from './dto/forgot-password.dto.js';
import { CreatedApiTokenDto } from './dto/create-api-token.dto.js';
import { Role, AuthPrincipal, resolveRole } from './auth.roles.js';
import { OAuthService, OAuthProviderName } from './oauth/oauth.service.js';
import { MailerService } from './mailer.service.js';
import { randomUUID } from 'crypto';
import { parseUserAgent } from './user-agent.util.js';

const BCRYPT_ROUNDS = 12;

/** Account with only the fields safe to expose to clients. */
export type PublicUser = AuthPrincipal & {
  firstName: string;
  lastName: string;
};

/**
 * Auth feature: account registration/login, Google/Outlook sign-in and
 * machine API tokens.
 *
 * Roles: accounts created over HTTP are `client` by default unless their
 * email is listed in `ADMIN_EMAILS`. API tokens are stored SHA-256 hashed,
 * and JWT access tokens carry the user role for authorization.
 */
@Injectable()
export class AuthService {
  private readonly adminEmails: Set<string>;
  private readonly frontendBase: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ApiToken)
    private readonly tokensRepository: Repository<ApiToken>,
    private readonly jwt: JwtService,
    config: ConfigService,
    private readonly oauth: OAuthService,
    private readonly mailer: MailerService,
  ) {
    this.adminEmails = new Set(
      (config.get<string>('ADMIN_EMAILS', '') ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    );

    this.frontendBase = config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
  }

  /** Base URL the frontend SPA is served from (for OAuth redirects). */
  frontendBaseUrl(): string {
    return this.frontendBase;
  }

  /**
   * Create a password account and return an immediate session.
   *
   * @throws ConflictException when the email is already registered.
   */
  async register(
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    },
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.usersRepository.exists({ where: { email } });

    if (existing) {
      throw new ConflictException(`Email ${email} is already registered`);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        email,
        role: this.resolveRole(email),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() ?? null,
        passwordHash,
      }),
    );

    return this.session(user, userAgent);
  }

  /**
   * Authenticate credentials and mint a JWT access token.
   *
   * @throws UnauthorizedException when the credentials are wrong or the
   * account uses OAuth-only login (no password set).
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const normalized = this.normalizeEmail(email);

    const user = await this.usersRepository.findOne({
      where: { email: normalized },
    });

    if (
      !user ||
      user.passwordHash === null ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.session(user, userAgent);
  }

  /**
   * Reset an account password to a freshly generated temporary one.
   *
   * This method never reveals whether an email exists: the response is
   * identical for unknown emails, OAuth-only accounts, and valid accounts
   * with a password. The temporary password is delivered out of band by
   * the mailer and never returned in the HTTP body.
   *
   * @param email the login email of the account to reset.
   * @returns a neutral confirmation message.
   */
  async resetPassword(email: string): Promise<ForgotPasswordResponseDto> {
    const normalized = this.normalizeEmail(email);

    const NEUTRAL_MESSAGE =
      'If an account exists for that email, a temporary password has been sent.';

    const user = await this.usersRepository.findOne({
      where: { email: normalized },
    });

    if (!user) {
      await bcrypt.hash('timing-equalizer', BCRYPT_ROUNDS);
      return { message: NEUTRAL_MESSAGE };
    }

    if (user.passwordHash === null) {
      return { message: NEUTRAL_MESSAGE };
    }

    const temporaryPassword = generateTemporaryPassword();
    user.passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    await this.usersRepository.save(user);

    await this.mailer.sendTemporaryPassword(user.email, temporaryPassword);

    return { message: NEUTRAL_MESSAGE };
  }

  /** Whether an OAuth provider is available (credentials configured). */
  oauthConfigured(provider: OAuthProviderName): boolean {
    return this.oauth.isConfigured(provider);
  }

  /** Consent URL to start a Google/Outlook sign-in. */
  oauthAuthorizeUrl(provider: OAuthProviderName): string {
    if (!this.oauth.isConfigured(provider)) {
      throw new ServiceUnavailableException(
        `${provider} login is not configured`,
      );
    }

    return this.oauth.buildAuthorizeUrl(provider);
  }

  /** Complete a Google/Outlook callback and mint a session. */
  async oauthCallback(
    provider: OAuthProviderName,
    code: string,
    state: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const profile = await this.oauth.exchangeIdentity(provider, code, state);
    const user = await this.upsertOauthUser(profile);

    return this.session(user, userAgent);
  }

  /**
   * Create a machine API token for a user.
   *
   * The plaintext token is generated once, hashed for storage and returned
   * in the response; it cannot be retrieved afterwards.
   */
  async createApiToken(
    userId: string,
    name: string,
  ): Promise<CreatedApiTokenDto> {
    const { raw, hash, prefix } = generateApiToken();

    const token = await this.tokensRepository.save(
      this.tokensRepository.create({
        user: { id: userId } as User,
        name,
        tokenHash: hash,
        prefix,
      }),
    );

    return {
      id: token.id,
      token: raw,
      prefix: token.prefix,
      name: token.name,
      createdAt: token.createdAt,
    };
  }

  /** List a user's active API tokens (metadata only). */
  async listApiTokens(userId: string): Promise<ApiToken[]> {
    return this.tokensRepository.find({
      where: { user: { id: userId }, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revoke a user's API token.
   *
   * @throws NotFoundException when the token does not belong to the user.
   */
  async revokeApiToken(userId: string, tokenId: string): Promise<void> {
    const result = await this.tokensRepository.update(
      { id: tokenId, user: { id: userId } },
      { revokedAt: new Date() },
    );

    if (!result.affected) {
      throw new NotFoundException(`API token ${tokenId} not found`);
    }
  }

  /**
   * Validate an API token and resolve its principal (including role).
   *
   * @param rawToken plaintext token from the `x-api-key` header.
   * @throws UnauthorizedException when the token is unknown or revoked.
   */
  async validateApiToken(rawToken: string): Promise<AuthPrincipal> {
    const token = await this.tokensRepository.findOne({
      where: { tokenHash: hashToken(rawToken), revokedAt: IsNull() },
      relations: { user: true },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or revoked API token');
    }

    token.lastUsedAt = new Date();
    await this.tokensRepository.save(token);

    return this.principal(token.user);
  }

  private async upsertOauthUser(profile: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  }): Promise<User> {
    const email = this.normalizeEmail(profile.email);
    let user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      user = await this.usersRepository.save(
        this.usersRepository.create({
          email,
          role: this.resolveRole(email),
          firstName: profile.firstName ?? email.split('@')[0],
          lastName: profile.lastName ?? '',
          phone: null,
          passwordHash: null,
        }),
      );
      return user;
    }

    const promoted = this.resolveRole(email);
    if (promoted === 'admin' && user.role !== 'admin') {
      user.role = promoted;
      await this.usersRepository.save(user);
    }

    return user;
  }

  /** Map an email to an admin/client role based on ADMIN_EMAILS. */
  private resolveRole(email: string): Role {
    return resolveRole(email, [...this.adminEmails]);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private principal(user: User): AuthPrincipal {
    return { id: user.id, email: user.email, role: user.role };
  }

  /**
   * Create a session for a user:
   *  - generates a new sessionId,
   *  - persists it as currentSessionId (invalidating any previous session),
   *  - updates lastLoginAt / lastLoginBrowser / lastLoginOs,
   *  - signs a JWT containing the sessionId.
   */
  private async session(
    user: User,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const previousSessionInvalidated = user.currentSessionId !== null;

    const sessionId = randomUUID();
    const { browser, os } = parseUserAgent(userAgent);

    user.currentSessionId = sessionId;
    user.lastLoginAt = new Date();
    user.lastLoginBrowser = browser;
    user.lastLoginOs = os;
    await this.usersRepository.save(user);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        lastLoginBrowser: user.lastLoginBrowser,
        lastLoginOs: user.lastLoginOs,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      previousSessionInvalidated,
    };
  }
}
