import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../../common/authz/authenticated-request.js';
import { Role } from '../auth.roles.js';

/**
 * Enforces role-based access on routes decorated with `@Roles(...)`.
 *
 * Must be combined with an authenticating guard (`JwtAuthGuard` or
 * `ApiKeyGuard`) that populates `req.user` first. When no `@Roles` metadata
 * is present the guard allows the request, so it can be applied broadly.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        `Requires one of the roles: ${required.join(', ')}`,
      );
    }

    return true;
  }
}
