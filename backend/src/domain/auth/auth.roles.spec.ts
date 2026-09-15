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