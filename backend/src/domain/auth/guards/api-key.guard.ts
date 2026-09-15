import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service.js';

/**
 * Authenticates requests carrying a machine API token in the `x-api-key`
 * header. On success attaches `req.user` (the token's owner) so handlers can
 * scope resources to the authenticated account.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const apiKey = request.headers?.['x-api-key'];

    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    request.user = await this.auth.validateApiToken(apiKey);

    return true;
  }
}