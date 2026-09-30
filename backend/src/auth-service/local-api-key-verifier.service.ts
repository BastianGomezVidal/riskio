import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ApiToken } from '../domain/auth/entities/api-token.entity.js';
import { hashToken } from '../domain/auth/auth.utils.js';
import type {
  ApiKeyVerifier,
  AuthPrincipal,
} from '../common/authz/authz.ports.js';

/**
 * Resolves a machine API key against its stored SHA-256 hash.
 *
 * This is the same logic that used to sit in AuthService.validateApiToken,
 * including the `lastUsedAt` write: it was in the guard's path then and it is in
 * the path now, so the two are interchangeable and the "last used" column
 * keeps meaning the same thing. There is no expiry on these tokens — revocation
 * is the only way they stop working.
 */
@Injectable()
export class LocalApiKeyVerifier implements ApiKeyVerifier {
  constructor(
    @InjectRepository(ApiToken)
    private readonly tokens: Repository<ApiToken>,
  ) {}

  async verify(apiKey: string): Promise<AuthPrincipal> {
    const token = await this.tokens.findOne({
      where: { tokenHash: hashToken(apiKey), revokedAt: IsNull() },
      relations: { user: true },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or revoked API token');
    }

    token.lastUsedAt = new Date();
    await this.tokens.save(token);

    return {
      id: token.user.id,
      email: token.user.email,
      role: token.user.role,
    };
  }
}
