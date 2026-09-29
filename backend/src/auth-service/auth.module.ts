import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { authEnvValidationSchema } from '../config/env.validation.js';
import { AuthModule } from '../domain/auth/auth.module.js';
import { UsersModule } from '../domain/users/users.module.js';
import { User } from '../domain/auth/entities/user.entity.js';
import { ApiToken } from '../domain/auth/entities/api-token.entity.js';
import { PasswordResetToken } from '../domain/auth/entities/password-reset-token.entity.js';
import { AUTH_CHECKER, API_KEY_VERIFIER } from '../common/authz/authz.ports.js';
import { LocalAuthChecker } from './local-auth-checker.service.js';
import { LocalApiKeyVerifier } from './local-api-key-verifier.service.js';
import { AuthzGuardsModule } from '../common/authz/authz-guards.module.js';
import { JwtAuthGuard } from '../domain/auth/guards/jwt-auth.guard.js';
import { AuthInternalController } from './auth-internal.controller.js';
import { AuthHealthController } from './auth-health.controller.js';
import { ObservabilityModule } from '../config/observability.module.js';
import { AppCacheModule } from '../domain/cache/cache.module.js';
import { StorageModule } from '../domain/storage/storage.module.js';

/**
 * The auth service: accounts, sessions, machine tokens and the user profile.
 *
 * It owns `JWT_SECRET` and the users table, and it is the only process that
 * does. The API does **not** hold the secret and does **not** read the table:
 * it asks this service for a decision, and gets one.
 *
 * The database stays shared, as it does everywhere else in this project. What
 * moved is ownership: nothing outside this process signs a token, hashes a
 * password or reads a password hash.
 *
 * `JWT_SECRET` being absent from the API is the point of the exercise, and it
 * was only reachable because `JwtAuthGuard` was rewritten to delegate. The guard
 * used to enforce single-active-session against a `Repository<User>`, which
 * meant the API could never stop owning that table.
 */
@Module({
  imports: [
    ObservabilityModule,
    AppCacheModule,
    StorageModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: authEnvValidationSchema,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [User, ApiToken, PasswordResetToken],
        migrationsRun: false,
        synchronize: false,
      }),
    }),
    AuthzGuardsModule.forRoot(LocalAuthChecker, LocalApiKeyVerifier, [
      AuthModule,
      // AuthModule registers the entities but does not export them, so the
      // repository tokens have to be registered where the checkers are built.
      TypeOrmModule.forFeature([User, ApiToken, PasswordResetToken]),
    ]),
    AuthModule,
    UsersModule,
    // The same reason, for the copies this module declares for its own
    // internal controller. Registering the entities twice is harmless; leaving
    // them out of one of the two contexts is a boot failure.
    TypeOrmModule.forFeature([User, ApiToken, PasswordResetToken]),
  ],
  controllers: [AuthInternalController, AuthHealthController],
  /**
   * The guards run here too, against the local checker, so this service
   * enforces its own session rules on `/auth/tokens` and `/users/me` instead
   * of trusting the network to be friendly. The check is local, so the
   * double-check on a proxied request costs a signature verification and a
   * primary key lookup, and buys a service that is not defenseless if anything
   * else ever reaches the network.
   */
  providers: [
    // Declared here as well as through forRoot, because the internal controller
    // injects the tokens directly and Nest resolves those from this module's
    // own providers.
    LocalAuthChecker,
    LocalApiKeyVerifier,
    { provide: AUTH_CHECKER, useExisting: LocalAuthChecker },
    { provide: API_KEY_VERIFIER, useExisting: LocalApiKeyVerifier },
    // Only JwtAuthGuard is global, and deliberately so. RolesGuard runs on
    // the routes that declare it, which is what keeps it *after* ApiKeyGuard on
    // the admin trigger: a global RolesGuard would read the role from the
    // browser token before the API key had a chance to replace it, and reject
    // an administrator calling with a machine key as a client.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AUTH_CHECKER, API_KEY_VERIFIER, AuthzGuardsModule],
})
export class AuthServiceModule {}
