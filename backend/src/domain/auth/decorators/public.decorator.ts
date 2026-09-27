import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public: JwtAuthGuard will skip token verification.
 *
 * Use this on endpoints that must be reachable without authentication
 * (login, register, forgot-password, OAuth callbacks, health checks).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
