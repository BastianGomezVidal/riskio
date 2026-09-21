import { api } from "@/api/client";
import type { AdvisoryDetail, StormDetail } from "@/domain/storm";
import type { DashboardSummary, StormHistoryItem } from "@/domain/dashboard";
import type { Paginated } from "@/domain/common/types";
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
    map.delete(key); // allow retry on failure
    throw err;
  });

  map.set(key, { promise, cachedAt: now });

  // LRU eviction: Map preserves insertion order, so the first key is
  // the oldest entry.
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
const HISTORY_TTL_MS = 10 * 60_000;
const STORM_TTL_MS = 5 * 60_000;
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
/* History                                                             */
/* ------------------------------------------------------------------ */

interface HistoryState {
  promise: Promise<PreloadResult<Paginated<StormHistoryItem>>>;
  cachedAt: number;
}

let historyState: HistoryState | null = null;

export function preloadHistory(): Promise<
  PreloadResult<Paginated<StormHistoryItem>>
> {
  const now = Date.now();

  if (historyState && now - historyState.cachedAt < HISTORY_TTL_MS) {
    return historyState.promise;
  }

  const promise = toPreloadResult(() => api.stormHistory());
  historyState = { promise, cachedAt: now };
  return promise;
}

export function resetHistory(): void {
  historyState = null;
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
/* Advisory detail (per UUID)                                          */
/* ------------------------------------------------------------------ */

const advisoryCache = new Map<
  string,
  CacheEntry<PreloadResult<AdvisoryDetail>>
>();

export function preloadAdvisory(
  id: string,
): Promise<PreloadResult<AdvisoryDetail>> {
  return cachedFetch(
    advisoryCache,
    id,
    () => toPreloadResult(() => api.advisory(id)),
    ADVISORY_TTL_MS,
  );
}

export function resetAdvisory(id?: string): void {
  if (id) advisoryCache.delete(id);
  else advisoryCache.clear();
}

/* ------------------------------------------------------------------ */
/* Logout / error-boundary reset                                       */
/* ------------------------------------------------------------------ */

export function resetAllCaches(): void {
  resetHealth();
  resetDashboardSummary();
  resetHistory();
  stormCache.clear();
  advisoryCache.clear();
}
