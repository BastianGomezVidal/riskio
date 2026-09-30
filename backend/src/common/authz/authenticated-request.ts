import type { AuthPrincipal } from './authz.ports.js';

/**
 * The part of an incoming request the auth path reads and writes.
 *
 * `ExecutionContext.switchToHttp().getRequest()` is declared as returning `any`,
 * so every `request.headers` and `request.user` in the guards and the
 * `@CurrentUser()` decorator was an unchecked access — 13 unsafe findings that
 * no amount of reading the surrounding code could resolve, because there was no
 * type to read them against. This is that type.
 *
 * It is deliberately not Express's `Request`. The guards are also mounted in the
 * auth service, where the request is a plain object supplied by Nest, and
 * naming only the fields the auth path touches keeps that working.
 */
export interface AuthenticatedRequest {
  /** Node lower-cases header names, so `authorization` and `x-api-key`. */
  headers: Record<string, string | string[] | undefined>;
  /** Set by the guards once a principal is resolved. */
  user?: AuthPrincipal;
}
