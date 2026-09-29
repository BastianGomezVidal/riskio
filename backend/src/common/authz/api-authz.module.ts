import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../../domain/auth/guards/jwt-auth.guard.js';
import { AuthzGuardsModule } from './authz-guards.module.js';
import { HttpAuthChecker } from './http-auth-checker.service.js';
import { AuthProxyMiddleware } from '../../domain/auth/auth-proxy.middleware.js';

/**
 * What the API keeps of authentication: enforcement, not credentials.
 *
 * The guards and the two global registrations stay, because the API is the edge
 * and something has to check a token before a request reaches a handler. What
 * went away is everything that needed the secret or the users table: this
 * module holds neither `JWT_SECRET` nor a repository, and asks the auth service
 * for both decisions.
 */
@Module({
  imports: [ConfigModule, AuthzGuardsModule.forRoot(HttpAuthChecker)],
  providers: [
    // Only JwtAuthGuard is global, and deliberately so. RolesGuard runs on
    // the routes that declare it, which is what keeps it *after* ApiKeyGuard on
    // the admin trigger: a global RolesGuard would read the role from the
    // browser token before the API key had a chance to replace it, and reject
    // an administrator calling with a machine key as a client.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // The proxy lives here rather than in AppModule because it needs the
    // checker, and main.ts mounts it with app.use('/auth') and app.use('/users').
    AuthProxyMiddleware,
  ],
  exports: [AuthzGuardsModule, AuthProxyMiddleware],
})
export class ApiAuthzModule {}
