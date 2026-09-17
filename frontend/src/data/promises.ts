import { api } from "@/api/client";
import type { AdvisoryDetail, StormDetail } from "@/domain/storm";
import type { DashboardSummary } from "@/domain/dashboard";

/* ------------------------------------------------------------------ */
/* Generic cache helper                                                */
/* ------------------------------------------------------------------ */

const MAX_CACHE = 200;

function cachedFetch<K, V>(
  map: Map<K, Promise<V>>,
  key: K,
  fetch: () => Promise<V>,
): Promise<V> {
  let promise = map.get(key);
  if (!promise) {
    promise = fetch().catch((err) => {
      map.delete(key); // allow retry on failure
      throw err;
    });
    map.set(key, promise);
    if (map.size > MAX_CACHE) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) map.delete(oldest);
    }
  }
  return promise;
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

let healthPromise: Promise<{ status: string }> | null = null;
let healthFetchedAt = 0;
const HEALTH_TTL_MS = 30_000;

export function preloadHealth(): Promise<{ status: string }> {
  const now = Date.now();
  if (!healthPromise || now - healthFetchedAt > HEALTH_TTL_MS) {
    healthPromise = api.health().catch((err) => {
      healthPromise = null;
      throw err;
    });
    healthFetchedAt = now;
  }
  return healthPromise;
}

export function resetHealth(): void {
  healthPromise = null;
  healthFetchedAt = 0;
}

/* ------------------------------------------------------------------ */
/* Dashboard summary                                                   */
/* ------------------------------------------------------------------ */

let dashboardSummaryPromise: Promise<DashboardSummary> | null = null;

export function preloadDashboardSummary(): Promise<DashboardSummary> {
  dashboardSummaryPromise ??= api.dashboardSummary().catch((err) => {
    dashboardSummaryPromise = null;
    throw err;
  });
  return dashboardSummaryPromise;
}

export function resetDashboardSummary(): void {
  dashboardSummaryPromise = null;
}

/* ------------------------------------------------------------------ */
/* Storm detail (per atcfId)                                           */
/* ------------------------------------------------------------------ */

const stormCache = new Map<string, Promise<StormDetail>>();

export function preloadStorm(atcfId: string): Promise<StormDetail> {
  return cachedFetch(stormCache, atcfId, () => api.storm(atcfId));
}

export function resetStorm(atcfId?: string): void {
  if (atcfId) stormCache.delete(atcfId);
  else stormCache.clear();
}

/* ------------------------------------------------------------------ */
/* Advisory detail (per UUID)                                          */
/* ------------------------------------------------------------------ */

const advisoryCache = new Map<string, Promise<AdvisoryDetail>>();

export function preloadAdvisory(id: string): Promise<AdvisoryDetail> {
  return cachedFetch(advisoryCache, id, () => api.advisory(id));
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
  stormCache.clear();
  advisoryCache.clear();
}
