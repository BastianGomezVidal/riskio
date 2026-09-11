import { describe, it, expect } from 'vitest';
import { envValidationSchema } from './env.validation.js';

/**
 * Unit tests for the environment contract in {@link envValidationSchema}.
 *
 * These guard the fail-fast boot behavior: missing credentials must reject,
 * defaults must fill in for optional knobs, and malformed values must fail.
 */
describe('envValidationSchema', () => {
  const validEnv = {
    DATABASE_URL:
      'postgresql://riskio:riskio_dev_password@localhost:5432/riskio',
    POSTGRES_USER: 'riskio',
    POSTGRES_PASSWORD: 'riskio_dev_password',
    POSTGRES_DB: 'riskio',
  };

  it('accepts a minimal valid environment and applies defaults', () => {
    const { error, value } = envValidationSchema.validate(validEnv);

    expect(error).toBeUndefined();
    expect(value.API_PORT).toBe(3000);
    expect(value.POSTGRES_PORT).toBe(5432);
    expect(value.NHC_BASE_URL).toBe('https://www.nhc.noaa.gov');
    expect(value.NHC_TIMEOUT_MS).toBe(10_000);
    expect(value.CORS_ORIGINS).toBe('');
  });

  it('rejects when required credentials are missing', () => {
    const { error } = envValidationSchema.validate({});

    expect(error).toBeDefined();
    expect(error!.message).toContain('DATABASE_URL');
  });

  it('rejects a malformed DATABASE_URL', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DATABASE_URL: 'not-a-uri',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('DATABASE_URL');
  });

  it('rejects a malformed NHC_BASE_URL override', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      NHC_BASE_URL: 'not-a-uri',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('NHC_BASE_URL');
  });
});
