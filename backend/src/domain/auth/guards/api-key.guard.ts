import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  API_KEY_VERIFIER,
  type ApiKeyVerifier,
} from '../../../common/authz/authz.ports.js';

/**
 * Authenticates requests carrying a machine API key in `x-api-key`.
 *
 * The verification is delegated to an {@link ApiKeyVerifier}: locally against
 * the database in the auth service, over HTTP everywhere else. Only the
 * `/admin` endpoints use this, so the cost of the hop lands on the paths where
 * a machine calls, not on browser traffic.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(API_KEY_VERIFIER) private readonly verifier: ApiKeyVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const apiKey = request.headers?.['x-api-key'];

    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    request.user = await this.verifier.verify(apiKey);

    return true;
  }
}
