import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_CHECKER,
  type AuthChecker,
} from '../../../common/authz/authz.ports.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Authenticates requests carrying a Bearer JWT access token.
 *
 * Registered globally via APP_GUARD. Routes marked with @Public() skip
 * the check entirely, which is why login, registration and health never depend
 * on authentication being available.
 *
 * The check itself is delegated to an {@link AuthChecker}. It used to be done
 * here against a `Repository<User>`, which is what made extracting the auth
 * service impossible: the guard needs the recorded session on every request,
 * and that state lives with the users. Whichever process runs this guard now
 * asks whoever owns the users — locally in the auth service, over HTTP in the
 * API.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_CHECKER) private readonly checker: AuthChecker,
    private readonly reflector: Reflector,
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

    request.user = await this.checker.check(token);

    return true;
  }
}
