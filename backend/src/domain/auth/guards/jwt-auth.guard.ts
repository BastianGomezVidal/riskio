import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthPrincipal, Role } from '../auth.roles.js';

/**
 * Authenticates requests carrying a Bearer JWT access token.
 *
 * On success attaches `req.user` (id, email, role) resolved from the token
 * claims. Used with the token-management endpoints and role-protected routes.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers?.authorization ?? '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        role: Role;
      }>(token);

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      } satisfies AuthPrincipal;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}