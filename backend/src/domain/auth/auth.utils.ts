import { createHash, randomBytes } from 'node:crypto';

/** Prefix applied to plaintext API tokens so they are recognizable. */
export const API_TOKEN_PREFIX = 'riskio_';

const DURATION_MULTIPLIERS: Record<'s' | 'm' | 'h' | 'd', number> = {
  s: 1,
  m: 60,
  h: 3_600,
  d: 86_400,
};

/**
 * Parse a human-friendly duration like `90m`, `6h` or `7d` into seconds.
 *
 * @param value duration string with an `s`, `m`, `h` or `d` unit.
 * @returns the equivalent number of seconds.
 * @throws Error when the value is not a valid duration.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration "${value}" (expected e.g. 15m, 6h, 7d)`);
  }

  return (
    Number(match[1]) * DURATION_MULTIPLIERS[match[2] as 's' | 'm' | 'h' | 'd']
  );
}

/** Randomly generated API token plus its stored hash and display prefix. */
export interface GeneratedApiToken {
  /** Plaintext token returned to the caller exactly once. */
  raw: string;

  /** SHA-256 hex digest stored in the database. */
  hash: string;

  /** First characters of the token, shown in listings. */
  prefix: string;
}

/**
 * Generate a new API token.
 *
 * The plaintext token is returned once; only the hash is persisted.
 *
 * @returns GeneratedApiToken fields derived from 256 bits of randomness.
 */
export function generateApiToken(): GeneratedApiToken {
  const raw = randomBytes(32).toString('base64url');

  return {
    raw: `${API_TOKEN_PREFIX}${raw}`,
    hash: hashToken(raw),
    prefix: raw.slice(0, 8),
  };
}

/**
 * Hash an API token for storage/comparison.
 *
 * Accepts either the raw token or the prefixed plaintext form
 * (`riskio_...`); the prefix is stripped before hashing so both
 * representations compare equal.
 *
 * SHA-256 here is deliberate and is not a password hash.
 *
 * CodeQL reports `js/insufficient-password-hash` on this line. It is keyed on
 * the function being named `hash*` and taking a `value`, and the concern it
 * raises is real for a password and does not apply to this value:
 *
 * - A password is low entropy and chosen by a human, so the attack is to
 *   compute SHA-256 of a wordlist. A slow hash (bcrypt, scrypt, argon2) exists
 *   to make each guess expensive. This token is 32 bytes from
 *   `randomBytes`, so there is no wordlist to guess and nothing to slow down.
 * - The stored value is never used to verify a login. Nothing authenticates
 *   by re-hashing a submitted secret and comparing, which is the operation the
 *   rule is really about. Tokens are compared with `timingSafeEqual` against
 *   the stored digest, so the digest cannot be attacked offline at all; the
 *   attacker would need the digest itself, and holding it is the position.
 *
 * Slow hashing would also be the wrong trade: this runs on every authenticated
 * request that presents a token, so bcrypt's cost is paid on the hot path to
 * protect a value that is already unguessable.
 *
 * @param value token to hash, with or without the prefix.
 * @returns SHA-256 hex digest.
 */
export function hashToken(value: string): string {
  const raw = value.startsWith(API_TOKEN_PREFIX)
    ? value.slice(API_TOKEN_PREFIX.length)
    : value;

  return createHash('sha256').update(raw).digest('hex');
}
