import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/auth/entities/user.entity.js';
import type { AuthChecker, AuthPrincipal } from '../common/authz/authz.ports.js';

/**
 * The real thing: verifies the signature and the session against the database.
 *
 * This is the code that used to live inside the guard, unchanged in behaviour.
 * It lives here because this process owns the users, and the state the check
 * needs — the recorded session — is a column on the user row.
 */
@Injectable()
export class LocalAuthChecker implements AuthChecker {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async check(bearerToken: string): Promise<AuthPrincipal> {
    let payload: {
      sub?: string;
      email?: string;
      role?: 'admin' | 'client';
      sessionId?: string;
    };

    try {
      payload = await this.jwt.verifyAsync(bearerToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!payload.sessionId || payload.sessionId !== user.currentSessionId) {
      throw new UnauthorizedException(
        'Your session was closed because you signed in on another device or browser.',
      );
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
