// src/auth/auth.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
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
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { generateApiToken, hashToken } from './auth.utils.js';
import { AuthResponseDto } from './dto/credentials.dto.js';
import {
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from './dto/forgot-password.dto.js';
import { CreatedApiTokenDto } from './dto/create-api-token.dto.js';
import { Role, AuthPrincipal, resolveRole } from './auth.roles.js';
import { OAuthService, OAuthProviderName } from './oauth/oauth.service.js';
import { MailerService } from './mailer.service.js';
import { randomBytes, randomUUID } from 'crypto';
import { parseUserAgent } from './user-agent.util.js';

const BCRYPT_ROUNDS = 12;

/**
 * How long a reset link stays redeemable. Long enough to survive a trip to
 * the inbox, short enough that a link found in a compromised mailbox has a
 * narrow window.
 */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

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
  private readonly logger = new Logger(AuthService.name);
  private readonly adminEmails: Set<string>;
  private readonly frontendBase: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ApiToken)
    private readonly tokensRepository: Repository<ApiToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokensRepository: Repository<PasswordResetToken>,
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
   * Issue a single-use link that lets the account owner choose a new password.
   *
   * Nothing about the account changes here. The previous version generated a
   * temporary password and saved it immediately, so a request from anyone who
   * knew an email invalidated the real password while the replacement was
   * only ever written to a log.
   *
   * The response never reveals whether an email exists: it is identical for
   * unknown emails, OAuth-only accounts, and valid accounts with a password.
   * The link is delivered out of band and never returned in the HTTP body.
   *
   * @param email the login email of the account to reset.
   * @returns a neutral confirmation message.
   */
  async requestPasswordReset(
    email: string,
  ): Promise<ForgotPasswordResponseDto> {
    const normalized = this.normalizeEmail(email);

    const NEUTRAL_MESSAGE =
      'If that account exists, a link to set a new password has been sent.';

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

    // Only one live link per account: issuing a new one retires the old, so a
    // link that leaked earlier stops working.
    await this.resetTokensRepository.update(
      { user: { id: user.id }, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const token = randomBytes(32).toString('base64url');
    await this.resetTokensRepository.save(
      this.resetTokensRepository.create({
        user,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        usedAt: null,
      }),
    );

    // A delivery failure must not change the response. The reply is identical
    // for real and unknown addresses, and a 500 here would give that away:
    // broken SMTP would become an oracle for which emails are registered.
    try {
      await this.mailer.sendPasswordResetLink(
        user.email,
        `${this.frontendBase}/reset-password?token=${token}`,
      );
    } catch (error) {
      this.logger.error(
        `Could not deliver the reset link to ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return { message: NEUTRAL_MESSAGE };
  }

  /**
   * Redeem a reset link and store the password the user chose.
   *
   * Expired, already-used and unknown tokens are all reported the same way, so
   * a caller cannot probe which tokens once existed.
   *
   * @param token the plaintext token from the emailed link.
   * @param newPassword the password to store from now on.
   * @returns a neutral confirmation message.
   * @throws BadRequestException when the token is unknown, spent or expired.
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<ResetPasswordResponseDto> {
    const INVALID =
      'That reset link is no longer valid. Request a new one and try again.';

    const record = await this.resetTokensRepository.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });

    if (!record || record.usedAt !== null) {
      throw new BadRequestException(INVALID);
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(INVALID);
    }

    record.user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.save(record.user);

    record.usedAt = new Date();
    await this.resetTokensRepository.save(record);

    return { message: 'Password updated. You can sign in now.' };
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

    /**
     * Role is re-resolved on every login, in both directions.
     *
     * This used to only promote, which meant removing an email from
     * ADMIN_EMAILS did nothing to an account that had already been promoted:
     * the row kept `admin` and the config quietly stopped matching reality. The
     * list is meant to be the source of truth for who is an admin, so a change
     * to it has to take effect rather than only applying to people who had not
     * logged in since.
     */
    const resolved = this.resolveRole(email);
    if (resolved !== user.role) {
      user.role = resolved;
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
