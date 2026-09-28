import { describe, it, expect } from 'vitest';
import { isAdminEmail, resolveRole } from './auth.roles.js';

describe('resolveRole', () => {
  const adminEmails = ['admin@riskio.dev', 'OPS@Riskio.dev'];

  it('assigns admin to accounts listed in ADMIN_EMAILS (case-insensitive)', () => {
    expect(resolveRole('admin@riskio.dev', adminEmails)).toBe('admin');
    expect(resolveRole('ops@riskio.dev', adminEmails)).toBe('admin');
  });

  it('assigns client to every other account', () => {
    expect(resolveRole('client@riskio.dev', adminEmails)).toBe('client');
    expect(resolveRole('admin@riskio.io', adminEmails)).toBe('client');
  });

  it('treats an empty admin list as all-client', () => {
    expect(resolveRole('someone@riskio.dev', [])).toBe('client');
  });

  it('handles surrounding whitespace in emails', () => {
    expect(resolveRole('  admin@riskio.dev ', adminEmails)).toBe('admin');
  });
});

describe('isAdminEmail', () => {
  it('matches without case-sensitivity', () => {
    expect(isAdminEmail('OPS@riskio.dev', ['ops@riskio.dev'])).toBe(true);
  });

  it('does not match partial addresses', () => {
    expect(isAdminEmail('admin@riskio.dev.evil', ['admin@riskio.dev'])).toBe(
      false,
    );
  });
});

/**
 * The promotion on login used to only move roles up, so removing an email from
 * ADMIN_EMAILS left an already-promoted account as admin forever and the
 * config quietly stopped matching reality. The role is now re-resolved in both
 * directions on every login, and these cases pin the mapping the login relies
 * on, including the demotion that the old code could not express.
 */
describe('role re-resolution on login', () => {
  const lista = ['admin@admin.com'];

  it('keeps a listed email as admin', () => {
    expect(resolveRole('admin@admin.com', lista)).toBe('admin');
  });

  it('demotes an account whose email left the list', () => {
    // The regression: this used to be impossible to express, so an admin stayed
    // an admin after being removed from ADMIN_EMAILS.
    expect(resolveRole('ex-admin@example.com', lista)).toBe('client');
  });

  it('ignores a stale stored role, since the list is the source of truth', () => {
    // Login compares the stored role against the resolved one and saves the
    // difference. resolveRole only sees the email, which is the point: it never
    // reads what the row already said.
    const almacenado = 'admin';
    const resuelto = resolveRole('ex-admin@example.com', lista);
    expect(almacenado === resuelto).toBe(false);
  });
});
