import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../common/authz/authenticated-request.js';
import { AuthPrincipal } from '../auth.roles.js';

/**
 * Resolves the authenticated principal attached by a guard
 * (`JwtAuthGuard` or `ApiKeyGuard`).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // The global guard runs before any handler, so `user` is always set by the
    // time a route that uses this decorator is reached. The assertion records
    // that invariant rather than hiding a missing check.
    return user as AuthPrincipal;
  },
);
