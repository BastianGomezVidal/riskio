/**
 * A machine API token, as the server describes one.
 *
 * There is no `tokenHash` here, and that is deliberate rather than an
 * oversight: the digest used to verify a token is not something a browser
 * needs, and the server used to send it anyway. If a field shows up in a
 * response and is not in this interface, the Zod schema drops it, so the
 * regression cannot come back quietly.
 */
export interface ApiToken {
  id: string;
  /** Human-readable label chosen at creation, e.g. "github-actions". */
  name: string;
  /** Non-secret leading fragment, shown so a token can be identified. */
  prefix: string;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp, or null when the token has never been presented. */
  lastUsedAt: string | null;
}

/**
 * A freshly created token.
 *
 * `token` is the plaintext and it is returned exactly once, at creation. There
 * is no endpoint that can produce it again — the server kept the digest — so
 * the UI has one chance to show it and cannot offer a "copy it later".
 */
export interface CreatedApiToken {
  id: string;
  /** Human-readable label, echoed back. */
  name: string;
  /** Non-secret leading fragment. */
  prefix: string;
  /** ISO timestamp. */
  createdAt: string;
  /**
   * The plaintext, returned exactly once.
   *
   * Deliberately not extending `ApiToken`: creation has no `lastUsedAt`,
   * because a token that has never been presented has never been used. Making it
   * extend the list item forced a nullable field into a response that does not
   * have one, and the strict schema would have thrown on the one call where the
   * user is looking at their new secret.
   */
  token: string;
}
