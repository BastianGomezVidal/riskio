import { DynamicModule, Module, Type } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces/modules/module-metadata.interface.js';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../../domain/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../domain/auth/guards/roles.guard.js';
import { ApiKeyGuard } from '../../domain/auth/guards/api-key.guard.js';
import { AUTH_CHECKER, API_KEY_VERIFIER } from './authz.ports.js';

/**
 * The guards, bound to whatever answers them.
 *
 * `forRoot` rather than a fixed module, because three processes run these guards
 * and each answers differently: the API asks the auth service over HTTP, the
 * auth service answers from its own database, and a test answers from the test
 * database. A single fixed module could only serve one of them.
 *
 * The tokens are provided here, next to the guards, and that is not
 * incidental. Nest resolves a provider's dependencies from its own module, so a
 * module holding the guards but not the token cannot construct them — which is
 * the error that a version of this file exporting tokens it did not own
 * produced at boot, and the one before it produced by trying to re-export them.
 */
@Module({})
export class AuthzGuardsModule {
  /**
   * `extraImports` exists for the local checker, which needs `JwtService` and
   * the user repository and so has to be constructed where those exist. The
   * HTTP checker needs neither, and asking this module to know about JWT or
   * TypeORM would tie the API's authorization to a database it must not have.
   */
  static forRoot(
    checker: Type,
    apiKeys: Type = checker,
    extraImports: ModuleMetadata['imports'] = [],
  ): DynamicModule {
    return {
      module: AuthzGuardsModule,
      imports: [ConfigModule, ...extraImports],
      providers: [
        { provide: AUTH_CHECKER, useClass: checker },
        { provide: API_KEY_VERIFIER, useClass: apiKeys },
        JwtAuthGuard,
        RolesGuard,
        ApiKeyGuard,
      ],
      // The tokens go out too, because a guard named in a consuming module's
      // @UseGuards is built in that module's context, where its dependencies
      // must be visible.
      exports: [JwtAuthGuard, RolesGuard, ApiKeyGuard, AUTH_CHECKER, API_KEY_VERIFIER],
    };
  }
}
