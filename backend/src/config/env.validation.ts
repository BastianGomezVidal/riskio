import Joi from 'joi';

/**
 * Environment contract for the Riskio API.
 *
 * Validation failures at boot fail fast so misconfigured deployments never
 * start up in a broken state.
 */
export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  API_PORT: Joi.number().default(3000),
  NHC_BASE_URL: Joi.string().uri().default('https://www.nhc.noaa.gov'),
  NHC_TIMEOUT_MS: Joi.number().default(10_000),
  /** Secret signing JWT access tokens. */
  JWT_SECRET: Joi.string().min(16).required(),
  /** Access token lifetime, e.g. `15m` or `7d`. */
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  /** Comma-separated browser origins allowed to call the API. Empty = allow all. */
  CORS_ORIGINS: Joi.string().allow('').default(''),
  /**
   * Comma-separated emails promoted to `admin` on register/login.
   * Every other account is a `client`.
   */
  ADMIN_EMAILS: Joi.string().allow('').default(''),
  /** Public base URL of this API, used to build OAuth callback URLs. */
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  /** Base URL of the frontend SPA, used to return from OAuth callbacks. */
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  /** Optional Google OAuth2 client credentials (enables Gmail sign-in). */
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  /** Optional Microsoft identity client credentials (enables Outlook sign-in). */
  MICROSOFT_CLIENT_ID: Joi.string().allow('').default(''),
  MICROSOFT_CLIENT_SECRET: Joi.string().allow('').default(''),

  /**
   * Object storage. STORAGE_ENDPOINT is empty when using the real AWS S3
   * endpoints, which S3StorageService detects to skip the local bucket
   * bootstrap.
   *
   * S3StorageService always passes explicit credentials to the client, so
   * there is no ambient credential chain to fall back on: these default to the
   * values SeaweedFS accepts. Pointing at MinIO or AWS means overriding both in
   * .env, and leaving them at `any` against a real S3 surfaces as a 403 on the
   * first upload rather than at boot.
   */
  STORAGE_DRIVER: Joi.string().default('s3'),
  STORAGE_ENDPOINT: Joi.string().allow('').default(''),
  STORAGE_REGION: Joi.string().default('us-east-1'),
  STORAGE_BUCKET: Joi.string().default('riskio-avatars'),
  STORAGE_ACCESS_KEY: Joi.string().default('any'),
  STORAGE_SECRET_KEY: Joi.string().default('any'),
  /**
   * Browser-facing base URL for stored objects. Must be reachable from the
   * browser, so it usually differs from STORAGE_ENDPOINT (which is only
   * resolvable inside the container network).
   */
  STORAGE_PUBLIC_URL: Joi.string()
    .uri()
    .default('http://localhost:8333/riskio-avatars'),

  /** Cache backend: `memory` (per-process) or `redis` (shared). */
  CACHE_DRIVER: Joi.string().valid('memory', 'redis').default('redis'),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://redis:6379'),

  /**
   * Outbound email. Only the password-reset link uses it today.
   *
   * `log` writes the message to the backend log instead of sending it. That is
   * convenient locally and a liability in production: a reset link in a log
   * file is a working credential for anyone who can read it. The choice is
   * therefore explicit rather than inferred from whether SMTP happens to be
   * configured, and a `log` deployment announces itself at boot.
   *
   * `smtp` is refused at boot unless the connection details are all present,
   * so a typo surfaces here instead of on the first reset someone requests.
   */
  MAIL_TRANSPORT: Joi.string().valid('log', 'smtp').default('log'),
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().default(587),
  /** Implicit TLS on 465, STARTTLS otherwise. */
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  /** Envelope sender and the From header. */
  MAIL_FROM: Joi.string()
    .email({ tlds: false })
    .default('riskio@example.com'),
})
  .custom((value, helpers) => {
    // Joi has no way to say "these three are required, but only when that other
    // one is set", so the conditional part is checked here. The point is that a
    // half-configured SMTP fails at boot: the alternative is discovering it when
    // a user asks to reset their password and the mail silently never arrives.
    if (value.MAIL_TRANSPORT !== 'smtp') {
      return value;
    }

    const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].filter(
      (key) => !String(value[key] ?? '').trim(),
    );

    if (missing.length > 0) {
      return helpers.message({
        custom: `MAIL_TRANSPORT=smtp but missing: ${missing.join(', ')}`,
      });
    }

    return value;
  });
