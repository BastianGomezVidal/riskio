import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthPrincipal } from '../auth.roles.js';

/**
 * Resolves the authenticated principal attached by a guard
 * (`JwtAuthGuard` or `ApiKeyGuard`).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    return context.switchToHttp().getRequest().user as AuthPrincipal;
  },
);