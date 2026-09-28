import { Body, Controller, Inject, Post } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Public } from '../domain/auth/decorators/public.decorator.js';
import {
  AUTH_CHECKER,
  API_KEY_VERIFIER,
  type AuthChecker,
  type ApiKeyVerifier,
  type AuthPrincipal,
} from '../common/authz/authz.ports.js';

/**
 * The contract the API uses to ask "may this request proceed?".
 *
 * Two operations, both of which answer with a principal or with a reason. The
 * reasons are passed through verbatim, because the distinction the API already
 * drew is worth keeping: an expired token, a superseded session and a missing
 * user are three different messages to the client, and collapsing them into one
 * "unauthorized" would lose that.
 *
 * No auth of its own. This is not reachable from outside the `core` network and
 * publishes no port; the API is its only caller, and it has already decided
 * there is a request worth asking about.
 */
/**
 * `@Public()` because the global guard would otherwise reject these before the
 * handler ran, and reject them for the right reason to be wrong: the caller
 * already proved the credential, it passed it in the body precisely so the
 * decision could be made here, and the token is not in a header.
 */
@Public()
@Controller('internal/auth')
export class AuthInternalController {
  constructor(
    @Inject(AUTH_CHECKER) private readonly checker: AuthChecker,
    @Inject(API_KEY_VERIFIER) private readonly apiKeys: ApiKeyVerifier,
  ) {}

  @Post('check')
  async check(@Body() body: { token?: string }): Promise<AuthPrincipal> {
    if (!body?.token) {
      throw new UnauthorizedException('Missing token');
    }
    return this.checker.check(body.token);
  }

  @Post('check-api-key')
  async checkApiKey(@Body() body: { apiKey?: string }): Promise<AuthPrincipal> {
    if (!body?.apiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }
    return this.apiKeys.verify(body.apiKey);
  }
}
