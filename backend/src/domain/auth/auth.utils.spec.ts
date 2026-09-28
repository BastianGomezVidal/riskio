import { describe, it, expect } from 'vitest';
import {
  generateApiToken,
  hashToken,
  API_TOKEN_PREFIX,
  parseDurationToSeconds,
} from './auth.utils.js';

describe('generateApiToken', () => {
  it('returns a unique prefixed token with hash and prefix', () => {
    const a = generateApiToken();
    const b = generateApiToken();

    expect(a.raw.startsWith(API_TOKEN_PREFIX)).toBe(true);
    expect(a.prefix).toBe(a.raw.slice(API_TOKEN_PREFIX.length, API_TOKEN_PREFIX.length + 8));
    expect(a.hash).not.toBe(a.raw);
    expect(a.raw).not.toBe(b.raw);
  });

  it('hashes deterministically with or without the prefix', () => {
    const { raw, hash } = generateApiToken();
    const unprefixed = raw.slice(API_TOKEN_PREFIX.length);

    expect(hashToken(raw)).toBe(hash);
    expect(hashToken(unprefixed)).toBe(hash);
  });
});

describe('parseDurationToSeconds', () => {
  it('parses s, m, h and d units', () => {
    expect(parseDurationToSeconds('45s')).toBe(45);
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('6h')).toBe(21_600);
    expect(parseDurationToSeconds('7d')).toBe(604_800);
  });

  it('throws on malformed durations', () => {
    expect(() => parseDurationToSeconds('15')).toThrow();
    expect(() => parseDurationToSeconds('abc')).toThrow();
  });
});
