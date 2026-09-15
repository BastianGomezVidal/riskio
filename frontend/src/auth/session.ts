/** Minimal signed-token handling so the SPA does not need a token library. */

const TOKEN_KEY = 'riskio.accessToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface TokenClaims {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
}

/**
 * Decode the JWT claims without verifying the signature. Used only to show
 * who is signed in; every protected backend call verifies the token itself.
 */
export function decodeTokenClaims(token: string): TokenClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TokenClaims;
  } catch {
    return null;
  }
}

/** True when a stored token exists and has not expired (claims `exp`). */
export function hasValidSession(): boolean {
  const token = getAccessToken();
  if (!token) return false;

  const claims = decodeTokenClaims(token);
  if (!claims?.exp) return true;

  return claims.exp * 1000 > Date.now();
}