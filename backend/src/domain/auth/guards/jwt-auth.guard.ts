import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import { AuthPrincipal, Role } from '../auth.roles.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Authenticates requests carrying a Bearer JWT access token.
 *
 * Registered globally via APP_GUARD. Routes marked with @Public() skip
 * the check entirely.
 *
 * Beyond signature verification, this guard enforces single-active-session:
 * the token's `sessionId` must match the user's `currentSessionId`. A newer
 * login invalidates any previous one, and older tokens return 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();

    const authorization = request.headers?.authorization ?? '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    let payload: {
      sub: string;
      email: string;
      role: Role;
      sessionId?: string;
    };

    try {
      payload = await this.jwt.verifyAsync(token);
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

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    } satisfies AuthPrincipal;

    return true;
  }
}
