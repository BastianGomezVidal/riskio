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
});
