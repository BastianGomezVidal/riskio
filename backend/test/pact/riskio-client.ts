export interface Storm {
  atcfId: string;
  name: string | null;
  basin: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AdvisorySummary {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
  rawText: string | null;
  ingestedAt: string;
}

export interface ForecastPoint {
  id: string;
  validAt: string;
  latitude: number;
  longitude: number;
  windSpeedKt: number | null;
  pressureMb: number | null;
  category: number | null;
}

export interface StormDetail extends Storm {
  advisories: AdvisorySummary[];
}

export interface AdvisoryDetail extends AdvisorySummary {
  forecastPoints: ForecastPoint[];
}

export interface IngestReport {
  basin: 'at' | 'ep' | 'cp';
  stormsSeen: number;
  stormsUpserted: number;
  advisoriesInserted: number;
  advisoriesSkipped: number;
  forecastPointsInserted: number;
  errors: string[];
}

export interface HealthResponse {
  status: string;
  info: Record<string, { status: string; responseTime?: number }>;
  error: Record<string, unknown>;
  details: Record<string, { status: string; responseTime?: number }>;
}

/**
 * Bearer token for the read endpoints.
 *
 * The API mounts a global JwtAuthGuard, so `/storms*` and `/advisories*` answer
 * 401 without an `Authorization` header. This client originally sent none, so
 * provider verification got a 401 on every guarded route and reported it as a
 * body mismatch: eleven interactions failing over one missing header.
 */
export const PACT_BEARER_TOKEN = 'pact-contract-read-token';

async function get<T>(
  baseUrl: string,
  path: string,
  token: string = PACT_BEARER_TOKEN,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

async function post<T>(
  baseUrl: string,
  path: string,
  apiKey: string,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

/**
 * API token the consumer presents on admin (ingestion) requests.
 *
 * The provider verification state handler seeds an admin account whose stored
 * token hash matches this value, so the guarded endpoints authenticate.
 */
export const PACT_API_KEY = 'riskio_pact_consumer_token';

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    body: string,
  ) {
    super(`riskio-api responded ${statusCode}: ${body}`);
  }
}

/** Read client for the Riskio API (used as the Pact consumer). */
export const riskioClient = {
  getHealth(baseUrl: string): Promise<HealthResponse> {
    return get(baseUrl, '/health');
  },

  listStorms(baseUrl: string): Promise<Storm[]> {
    return get(baseUrl, '/storms');
  },

  getStorm(baseUrl: string, atcfId: string): Promise<StormDetail> {
    return get(baseUrl, `/storms/${encodeURIComponent(atcfId)}`);
  },

  /**
   * One advisory of a storm, by number or `latest`.
   *
   * There is no `GET /storms/:atcfId/advisories` and there never was. The route
   * is `/storms/:atcfId/advisories/:n` and the `n` is required, because which
   * advisory you mean is ambiguous once a storm has twenty of them. The contract
   * described the list route, which 404s.
   */
  getAdvisoryForStorm(
    baseUrl: string,
    atcfId: string,
    n: string,
  ): Promise<{ storm: Storm; advisory: AdvisoryDetail }> {
    return get(
      baseUrl,
      `/storms/${encodeURIComponent(atcfId)}/advisories/${encodeURIComponent(n)}`,
    );
  },

  getAdvisory(baseUrl: string, advisoryId: string): Promise<AdvisoryDetail> {
    return get(baseUrl, `/advisories/${encodeURIComponent(advisoryId)}`);
  },

  /*
   * Deliberately absent: a `listForecastPoints` method.
   *
   * There is no `GET /advisories/:id/forecast-points` route. Forecast points are
   * embedded in the advisory detail, so one screen costs one round trip instead
   * of two. The contract described the two-step shape, so it described an API
   * nobody built.
   */

  runBasinIngest(baseUrl: string, basin: string): Promise<IngestReport> {
    return post(
      baseUrl,
      `/admin/ingest/run/${encodeURIComponent(basin)}`,
      PACT_API_KEY,
    );
  },

  runAllIngest(baseUrl: string): Promise<IngestReport[]> {
    return post(baseUrl, '/admin/ingest/run', PACT_API_KEY);
  },
};
