/** Account roles. `admin` can trigger ingestion; `client` can read data. */
export type Role = 'admin' | 'client';

/** Roles allowed to manage ingestion and other admin surfaces. */
export const ADMIN_ROLE: Role = 'admin';

/**
 * Authenticated principal attached to the request by a guard
 * (JWT or API key). `role` drives role-based authorization.
 */
export interface AuthPrincipal {
  id: string;
  email: string;
  role: Role;
}

/** Case-insensitive check for whether an email is in an admin list. */
export function isAdminEmail(
  email: string,
  adminEmails: readonly string[],
): boolean {
  const normalized = email.trim().toLowerCase();
  return adminEmails.some(
    (candidate) => candidate.trim().toLowerCase() === normalized,
  );
}

/**
 * Resolve the role an account should have. Emails listed as admins are
 * promoted; every other account is a client.
 */
export function resolveRole(
  email: string,
  adminEmails: readonly string[],
): Role {
  return isAdminEmail(email, adminEmails) ? ADMIN_ROLE : 'client';
}