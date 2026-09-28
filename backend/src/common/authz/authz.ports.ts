/**
 * Authorization, as the API and the auth service each see it.
 *
 * These are the two things a guard needs from whoever owns authentication, and
 * nothing more. They exist so the guards can be shared: the API runs them
 * against an HTTP implementation and the auth service against a local one, and
 * neither has to know which.
 *
 * The split was forced by a single fact: `JwtAuthGuard` does not just check a
 * signature. It enforces single-active-session, which means comparing the
 * token's `sessionId` against the session recorded for that user. That is
 * state, the state lives with the users, and therefore any request carrying a
 * token needs a decision from whoever owns the users.
 */
export interface AuthPrincipal {
  id: string;
  email: string;
  role: 'admin' | 'client';
}

/**
 * Resolves a bearer token to a principal, or explains why it cannot.
 *
 * Throwing is the contract, not returning null: the caller is a guard, and a
 * guard has to produce a 401 with a reason. The two implementations differ in
 * where the lookup happens and nothing else.
 */
export interface AuthChecker {
  /** @throws when the token is missing, malformed, expired or stale. */
  check(bearerToken: string): Promise<AuthPrincipal>;
}

/**
 * Resolves a machine API key to a principal.
 *
 * Separate from {@link AuthChecker} because the two are different credentials
 * with different lifetimes, and the admin endpoints demand both.
 */
export interface ApiKeyVerifier {
  /** @throws when the key is unknown, revoked or expired. */
  verify(apiKey: string): Promise<AuthPrincipal>;
}

/** DI tokens for the two interfaces above. */
export const AUTH_CHECKER = Symbol('AUTH_CHECKER');
export const API_KEY_VERIFIER = Symbol('API_KEY_VERIFIER');
