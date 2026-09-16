import {
  api,
  type Paginated,
  type Storm,
  type Advisory,
  type ForecastPoint,
} from "./client";

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
      map.delete(key); // allow retry
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
/* Storms                                                              */
/* ------------------------------------------------------------------ */

let stormsPromise: Promise<Paginated<Storm>> | null = null;

export function preloadStorms(): Promise<Paginated<Storm>> {
  stormsPromise ??= api.storms().catch((err) => {
    stormsPromise = null;
    throw err;
  });
  return stormsPromise;
}

export function resetStorms(): void {
  stormsPromise = null;
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
/* Advisories (per storm)                                              */
/* ------------------------------------------------------------------ */

const advisoriesCache = new Map<string, Promise<Paginated<Advisory>>>();

export function preloadAdvisories(
  atcfId: string,
): Promise<Paginated<Advisory>> {
  return cachedFetch(advisoriesCache, atcfId, () => api.advisories(atcfId));
}

export function resetAdvisories(atcfId?: string): void {
  if (atcfId) advisoriesCache.delete(atcfId);
  else advisoriesCache.clear();
}

/* ------------------------------------------------------------------ */
/* Forecast points (per advisory)                                      */
/* ------------------------------------------------------------------ */

const pointsCache = new Map<string, Promise<Paginated<ForecastPoint>>>();

export function preloadForecastPoints(
  advisoryId: string,
): Promise<Paginated<ForecastPoint>> {
  return cachedFetch(pointsCache, advisoryId, () =>
    api.forecastPoints(advisoryId),
  );
}

export function resetForecastPoints(advisoryId?: string): void {
  if (advisoryId) pointsCache.delete(advisoryId);
  else pointsCache.clear();
}

/* ------------------------------------------------------------------ */
/* Logout helper                                                       */
/* ------------------------------------------------------------------ */

export function resetAllCaches(): void {
  stormsPromise = null;
  resetHealth();
  advisoriesCache.clear();
  pointsCache.clear();
}
