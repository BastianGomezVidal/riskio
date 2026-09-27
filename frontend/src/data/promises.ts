import { api } from "@/api/client";
import type {
  StormAdvisoryDetail,
  StormDetail,
  StormListItem,
  StormsQuery,
} from "@/domain/storm";
import type { DashboardSummary } from "@/domain/dashboard";
import type { User } from "@/domain/users";
import { toPreloadResult, type PreloadResult } from "./preload-result";

/* ------------------------------------------------------------------ */
/* Generic cache helper                                                */
/* ------------------------------------------------------------------ */

const MAX_CACHE = 200;

interface CacheEntry<V> {
  promise: Promise<V>;
  cachedAt: number;
}

function cachedFetch<K, V>(
  map: Map<K, CacheEntry<V>>,
  key: K,
  fetch: () => Promise<V>,
  ttlMs: number,
): Promise<V> {
  const now = Date.now();
  const entry = map.get(key);

  if (entry && now - entry.cachedAt < ttlMs) {
    return entry.promise;
  }

  const promise = fetch().catch((err) => {
    map.delete(key);
    throw err;
  });

  map.set(key, { promise, cachedAt: now });

  if (map.size > MAX_CACHE) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }

  return promise;
}

/* ------------------------------------------------------------------ */
/* TTL constants                                                       */
/* ------------------------------------------------------------------ */

const HEALTH_TTL_MS = 30_000;
const DASHBOARD_TTL_MS = 2 * 60_000;
const STORMS_TTL_MS = 2 * 60_000;
const STORM_TTL_MS = 5 * 60_000;
const ME_TTL_MS = 5 * 60_000;
const ADVISORY_TTL_MS = Number.POSITIVE_INFINITY;

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

let healthState: {
  promise: Promise<{ status: string }>;
  cachedAt: number;
} | null = null;

export function preloadHealth(): Promise<{ status: string }> {
  const now = Date.now();

  if (!healthState || now - healthState.cachedAt > HEALTH_TTL_MS) {
    healthState = {
      promise: api.health().catch((err) => {
        healthState = null;
        throw err;
      }),
      cachedAt: now,
    };
  }

  return healthState.promise;
}

export function resetHealth(): void {
  healthState = null;
}

/* ------------------------------------------------------------------ */
/* Dashboard summary                                                   */
/* ------------------------------------------------------------------ */

let dashboardSummaryState: {
  promise: Promise<PreloadResult<DashboardSummary>>;
  cachedAt: number;
} | null = null;

export function preloadDashboardSummary(): Promise<
  PreloadResult<DashboardSummary>
> {
  const now = Date.now();

  if (
    dashboardSummaryState &&
    now - dashboardSummaryState.cachedAt < DASHBOARD_TTL_MS
  ) {
    return dashboardSummaryState.promise;
  }

  const promise = toPreloadResult(() => api.dashboardSummary());
  dashboardSummaryState = { promise, cachedAt: now };
  return promise;
}

export function resetDashboardSummary(): void {
  dashboardSummaryState = null;
}

/* ------------------------------------------------------------------ */
/* Storms directory (filters-aware)                                    */
/* ------------------------------------------------------------------ */

const stormsCache = new Map<
  string,
  CacheEntry<PreloadResult<StormListItem[]>>
>();

function stormsKey(query: StormsQuery): string {
  return JSON.stringify(query);
}

export function preloadStorms(
  query: StormsQuery,
): Promise<PreloadResult<StormListItem[]>> {
  const key = stormsKey(query);
  return cachedFetch(
    stormsCache,
    key,
    () => toPreloadResult(() => api.storms(query)),
    STORMS_TTL_MS,
  );
}

export function resetStorms(query?: StormsQuery): void {
  if (query) stormsCache.delete(stormsKey(query));
  else stormsCache.clear();
}

/* ------------------------------------------------------------------ */
/* Storm detail (per atcfId)                                           */
/* ------------------------------------------------------------------ */

const stormCache = new Map<string, CacheEntry<PreloadResult<StormDetail>>>();

export function preloadStorm(
  atcfId: string,
): Promise<PreloadResult<StormDetail>> {
  return cachedFetch(
    stormCache,
    atcfId,
    () => toPreloadResult(() => api.storm(atcfId)),
    STORM_TTL_MS,
  );
}

export function resetStorm(atcfId?: string): void {
  if (atcfId) stormCache.delete(atcfId);
  else stormCache.clear();
}

/* ------------------------------------------------------------------ */
/* Storm + advisory composite (per atcfId + number)                    */
/* ------------------------------------------------------------------ */

const stormAdvisoryCache = new Map<
  string,
  CacheEntry<PreloadResult<StormAdvisoryDetail>>
>();

export function preloadStormAdvisory(
  atcfId: string,
  advisoryNumber: string,
): Promise<PreloadResult<StormAdvisoryDetail>> {
  const key = `${atcfId}:${advisoryNumber}`;
  return cachedFetch(
    stormAdvisoryCache,
    key,
    () => toPreloadResult(() => api.stormAdvisory(atcfId, advisoryNumber)),
    ADVISORY_TTL_MS,
  );
}

export function resetStormAdvisory(
  atcfId?: string,
  advisoryNumber?: string,
): void {
  if (atcfId && advisoryNumber) {
    stormAdvisoryCache.delete(`${atcfId}:${advisoryNumber}`);
  } else {
    stormAdvisoryCache.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Current user profile                                                */
/* ------------------------------------------------------------------ */

let meState: {
  promise: Promise<PreloadResult<User>>;
  cachedAt: number;
} | null = null;

export function preloadMe(): Promise<PreloadResult<User>> {
  const now = Date.now();

  if (meState && now - meState.cachedAt < ME_TTL_MS) {
    return meState.promise;
  }

  const promise = toPreloadResult(() => api.me());
  meState = { promise, cachedAt: now };
  return promise;
}

export function resetMe(): void {
  meState = null;
}

/* ------------------------------------------------------------------ */
/* Logout / error-boundary reset                                       */
/* ------------------------------------------------------------------ */

export function resetAllCaches(): void {
  resetHealth();
  resetDashboardSummary();
  resetMe();
  stormCache.clear();
  stormsCache.clear();
  stormAdvisoryCache.clear();
}
