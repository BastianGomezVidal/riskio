import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../src/domain/auth/entities/user.entity.js';
import { ApiToken } from '../../src/domain/auth/entities/api-token.entity.js';
import { PasswordResetToken } from '../../src/domain/auth/entities/password-reset-token.entity.js';
import { AuthModule } from '../../src/domain/auth/auth.module.js';
import { UsersModule } from '../../src/domain/users/users.module.js';
import { AUTH_CHECKER, API_KEY_VERIFIER } from '../../src/common/authz/authz.ports.js';
import { LocalAuthChecker } from '../../src/auth-service/local-auth-checker.service.js';
import { LocalApiKeyVerifier } from '../../src/auth-service/local-api-key-verifier.service.js';
import { parseDurationToSeconds } from '../../src/domain/auth/auth.utils.js';
import { AuthzGuardsModule } from '../../src/common/authz/authz-guards.module.js';
import { JwtAuthGuard } from '../../src/domain/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/domain/auth/guards/roles.guard.js';

/**
 * The auth domain, in process, for tests.
 *
 * The real AuthServiceModule cannot be imported here: it opens its own database
 * connection, mints tokens with its own JWT module and listens on a port. What
 * a test needs is the real logic against the test database, with the remote
 * checker replaced by the local one.
 *
 * That replacement is the whole point of the two ports. Before them, the guard
 * reached for a repository directly and this file did not have to exist; the
 * API and the auth service could not both be mounted anywhere without dragging
 * the same table into both.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, ApiToken, PasswordResetToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET')!,
        signOptions: {
          expiresIn: parseDurationToSeconds(
            config.get<string>('JWT_EXPIRES_IN', '15m'),
          ),
        },
      }),
    }),
    AuthzGuardsModule.forRoot(LocalAuthChecker, LocalApiKeyVerifier, [
      AuthModule,
      TypeOrmModule.forFeature([User, ApiToken, PasswordResetToken]),
    ]),
    AuthModule,
    UsersModule,
  ],
  providers: [
    LocalAuthChecker,
    LocalApiKeyVerifier,
    { provide: AUTH_CHECKER, useExisting: LocalAuthChecker },
    { provide: API_KEY_VERIFIER, useExisting: LocalApiKeyVerifier },
    // The global guards live here rather than in ApiAuthzModule, because a test
    // has no auth service to call and the global registration would otherwise
    // use the HTTP checker and answer 503 to everything.
    // Only JwtAuthGuard is global, and deliberately so. RolesGuard runs on
    // the routes that declare it, which is what keeps it *after* ApiKeyGuard on
    // the admin trigger: a global RolesGuard would read the role from the
    // browser token before the API key had a chance to replace it, and reject
    // an administrator calling with a machine key as a client.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [
    AUTH_CHECKER,
    API_KEY_VERIFIER,
    AuthzGuardsModule.forRoot(LocalAuthChecker, LocalApiKeyVerifier, [
      AuthModule,
      TypeOrmModule.forFeature([User, ApiToken, PasswordResetToken]),
    ]),
    AuthModule,
    UsersModule,
  ],
})
export class TestAuthModule {}
