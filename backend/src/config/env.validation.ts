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

/**
 * Environment contract for the storage service.
 *
 * A separate schema on purpose, not a laxer version of the full one. The full
 * schema requires `DATABASE_URL` and `JWT_SECRET`, and the storage service
 * genuinely has neither: it holds no rows and signs no tokens. Pointing it at
 * the full schema would mean either shipping a database URL and a JWT secret
 * to a process that cannot use them, or loosening `.required()` across the
 * whole application to accommodate one service.
 *
 * The keys that stay are the S3 ones, because this is now the only process that
 * reads them. The API no longer gets STORAGE_ACCESS_KEY or STORAGE_SECRET_KEY
 * at all, which is the actual point of moving the service out.
 */
export const storageEnvValidationSchema = Joi.object({
  STORAGE_DRIVER: Joi.string().default('s3'),
  STORAGE_ENDPOINT: Joi.string().allow('').default(''),
  STORAGE_REGION: Joi.string().default('us-east-1'),
  STORAGE_BUCKET: Joi.string().default('riskio-avatars'),
  STORAGE_ACCESS_KEY: Joi.string().default('any'),
  STORAGE_SECRET_KEY: Joi.string().default('any'),
  STORAGE_PUBLIC_URL: Joi.string()
    .uri()
    .default('http://localhost:8333/riskio-avatars'),

  /**
   * Where the API finds this service. Only the API reads it, and only because
   * it no longer speaks S3 itself.
   */
  STORAGE_API_URL: Joi.string().uri().default('http://storage:3004'),
  /** Per-request timeout, so a wedged storage service cannot hang a request. */
  STORAGE_API_TIMEOUT_MS: Joi.number().default(5_000),
});

/**
 * Environment contract for the cache service.
 *
 * Its own schema for the same reason the storage service has one: this process
 * has no database and signs no tokens, so requiring DATABASE_URL and JWT_SECRET
 * here would mean shipping both to a service that cannot use them.
 *
 * REDIS_URL appears here and nowhere else in the stack. The API used to carry
 * it, and the whole point of the extraction is that the only holder of a cache
 * connection is the process that needs one.
 */
export const cacheEnvValidationSchema = Joi.object({
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://redis:6379'),
  /** Default TTL for entries that do not state one. */
  CACHE_DEFAULT_TTL_MS: Joi.number().default(60_000),
});

/**
 * Environment contract for the feeds service.
 *
 * Its own schema, like the storage and cache services: this process signs no
 * tokens and has no users, so requiring JWT_SECRET and ADMIN_EMAILS here would
 * mean shipping secrets it cannot use.
 *
 * What it does need is a database and NOAA. It does not need STORAGE_* (the
 * storage service owns those) and it does not need REDIS_URL (the cache service
 * owns that one) — both of which is the point of extracting those two first.
 */
export const feedsEnvValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),

  NHC_BASE_URL: Joi.string().uri().default('https://www.nhc.noaa.gov'),
  NHC_TIMEOUT_MS: Joi.number().default(10_000),

  // The cache is reached over HTTP, so this is a URL and not a connection.
  CACHE_SERVICE_URL: Joi.string().uri().default('http://backend-cache:3005'),
  CACHE_SERVICE_TIMEOUT_MS: Joi.number().default(1_000),
  CACHE_SERVICE_COOLDOWN_MS: Joi.number().default(10_000),
});

/**
 * Environment contract for the weather service.
 *
 * Its own schema, like the other extracted services: this one reads storms and
 * advisories and signs nothing. It needs a database and, for the storm listing,
 * the cache — and it needs neither the NOAA settings, which belong to feeds,
 * nor the storage ones, which belong to storage.
 */
export const weatherEnvValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  CACHE_SERVICE_URL: Joi.string().uri().default('http://backend-cache:3005'),
  CACHE_SERVICE_TIMEOUT_MS: Joi.number().default(1_000),
  CACHE_SERVICE_COOLDOWN_MS: Joi.number().default(10_000),
});

/**
 * Environment contract for the auth service.
 *
 * JWT_SECRET is required here and, since the extraction, **nowhere else**. The
 * API used to need it to verify signatures on every request; it now asks this
 * service for a decision instead, which is the whole reason the guard was
 * rewritten. If a second process ever needs the secret again, that is the
 * coupling this arrangement exists to remove.
 */
export const authEnvValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),

  ADMIN_EMAILS: Joi.string().allow('').default(''),
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),

  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  MICROSOFT_CLIENT_ID: Joi.string().allow('').default(''),
  MICROSOFT_CLIENT_SECRET: Joi.string().allow('').default(''),

  MAIL_TRANSPORT: Joi.string().valid('log', 'smtp').default('log'),
  MAIL_FROM: Joi.string().default('Riskio <no-reply@riskio.local>'),
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASSWORD: Joi.string().allow('').default(''),
  SMTP_SECURE: Joi.boolean().default(false),

  STORAGE_API_URL: Joi.string().uri().default('http://backend-storage:3004'),
  STORAGE_API_TIMEOUT_MS: Joi.number().default(5_000),

  CACHE_SERVICE_URL: Joi.string().uri().default('http://backend-cache:3005'),
  CACHE_SERVICE_TIMEOUT_MS: Joi.number().default(1_000),
  CACHE_SERVICE_COOLDOWN_MS: Joi.number().default(10_000),
});

/**
 * Environment contract for the gateway.
 *
 * The API validates against this instead of the full schema, and the list is
 * the point rather than a side effect. It needs a database to run migrations
 * and a URL for every service, and it needs nothing else: not the signing
 * secret, not the OAuth credentials, not the mailer.
 *
 * `env_file: .env` put JWT_SECRET in the API's environment regardless of what
 * any schema said, which is why removing it from the code was not enough. The
 * API no longer loads .env wholesale, so the secret is only where it is used.
 */
export const apiEnvValidationSchema = Joi.object({
  /** Only to run migrations. The API has no entities and reads no tables. */
  DATABASE_URL: Joi.string().uri().required(),

  CORS_ORIGINS: Joi.string().allow('').default(''),

  STORAGE_API_URL: Joi.string().uri().default('http://backend-storage:3004'),
  STORAGE_API_TIMEOUT_MS: Joi.number().default(5_000),

  CACHE_SERVICE_URL: Joi.string().uri().default('http://backend-cache:3005'),
  CACHE_SERVICE_TIMEOUT_MS: Joi.number().default(1_000),
  CACHE_SERVICE_COOLDOWN_MS: Joi.number().default(10_000),

  FEEDS_SERVICE_URL: Joi.string().uri().default('http://backend-feeds:3006'),
  FEEDS_SERVICE_TIMEOUT_MS: Joi.number().default(120_000),

  WEATHER_SERVICE_URL: Joi.string().uri().default('http://backend-weather:3007'),
  WEATHER_SERVICE_TIMEOUT_MS: Joi.number().default(5_000),

  AUTH_SERVICE_URL: Joi.string().uri().default('http://backend-auth:3008'),
  AUTH_SERVICE_TIMEOUT_MS: Joi.number().default(5_000),
});
