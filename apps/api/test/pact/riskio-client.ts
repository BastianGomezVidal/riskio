export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  hasNextPage: boolean;
}

export interface Paginated<T> {
  meta: PageMeta;
  data: T[];
}

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

  listStorms(
    baseUrl: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Storm>> {
    const q = new URLSearchParams();
    if (opts.page != null) q.set('page', String(opts.page));
    if (opts.limit != null) q.set('limit', String(opts.limit));
    return get(baseUrl, `/storms${q.size ? `?${q}` : ''}`);
  },

  getStorm(baseUrl: string, atcfId: string): Promise<StormDetail> {
    return get(baseUrl, `/storms/${encodeURIComponent(atcfId)}`);
  },

  listAdvisories(
    baseUrl: string,
    atcfId: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<AdvisorySummary>> {
    const q = new URLSearchParams();
    if (opts.page != null) q.set('page', String(opts.page));
    if (opts.limit != null) q.set('limit', String(opts.limit));
    return get(
      baseUrl,
      `/storms/${encodeURIComponent(atcfId)}/advisories${q.size ? `?${q}` : ''}`,
    );
  },

  getAdvisory(
    baseUrl: string,
    advisoryId: string,
  ): Promise<AdvisoryDetail> {
    return get(baseUrl, `/advisories/${encodeURIComponent(advisoryId)}`);
  },

  listForecastPoints(
    baseUrl: string,
    advisoryId: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<ForecastPoint>> {
    const q = new URLSearchParams();
    if (opts.page != null) q.set('page', String(opts.page));
    if (opts.limit != null) q.set('limit', String(opts.limit));
    return get(
      baseUrl,
      `/advisories/${encodeURIComponent(advisoryId)}/forecast-points${q.size ? `?${q}` : ''}`,
    );
  },

  runBasinIngest(baseUrl: string, basin: string): Promise<IngestReport> {
    return get(baseUrl, `/admin/ingest/run/${encodeURIComponent(basin)}`);
  },

  async runAllIngest(baseUrl: string): Promise<IngestReport[]> {
    const res = await fetch(`${baseUrl}/admin/ingest/run`, { method: 'POST' });
    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    return (await res.json()) as IngestReport[];
  },
};