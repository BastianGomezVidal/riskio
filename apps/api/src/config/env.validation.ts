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
  /** Comma-separated browser origins allowed to call the API. Empty = allow all. */
  CORS_ORIGINS: Joi.string().default(''),
});
