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

async function get<T>(baseUrl: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`);
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

  listAdvisories(
    baseUrl: string,
    atcfId: string,
  ): Promise<AdvisorySummary[]> {
    return get(baseUrl, `/storms/${encodeURIComponent(atcfId)}/advisories`);
  },

  getAdvisory(baseUrl: string, advisoryId: string): Promise<AdvisoryDetail> {
    return get(baseUrl, `/advisories/${encodeURIComponent(advisoryId)}`);
  },

  listForecastPoints(
    baseUrl: string,
    advisoryId: string,
  ): Promise<ForecastPoint[]> {
    return get(
      baseUrl,
      `/advisories/${encodeURIComponent(advisoryId)}/forecast-points`,
    );
  },

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
