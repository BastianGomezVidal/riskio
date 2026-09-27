import type { StormRiskLevel, StormsSort, StormsTab } from "./types";

/* ------------------------------------------------------------------ */
/* Base entities                                                       */
/* ------------------------------------------------------------------ */

export interface Storm {
  atcfId: string;
  name: string | null;
  basin: string;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
  lastSeenInFeedAt: string | null;
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

export interface Advisory {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
  rawText: string | null;
  ingestedAt: string;
  track: { type: "LineString"; coordinates: [number, number][] } | null;
  cone: { type: "Polygon"; coordinates: [number, number][][] } | null;
  storm?: Storm;
}

export interface AdvisoryDetail extends Advisory {
  forecastPoints: ForecastPoint[];
  warnings: { id: string; warningType: string }[];
}

export interface AdvisoryRef {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
}

/* ------------------------------------------------------------------ */
/* Storm aggregates                                                    */
/* ------------------------------------------------------------------ */

/**
 * Canonical storm shape returned by the API. Includes the aggregate
 * counters computed server-side. Does NOT include riskLevel — that
 * concept belongs to advisories, not storms.
 */
export interface StormAggregate extends Storm {
  advisoryCount: number;
  latestAdvisoryNumber: number | null;
  latestAdvisoryIssuedAt: string | null;
}

/** Alias kept for readability at call sites. */
export type StormDto = StormAggregate;

/** Alias for the list endpoint response. */
export type StormListItem = StormAggregate;

export interface StormDetail extends StormAggregate {
  advisories: AdvisoryRef[];
}

/* ------------------------------------------------------------------ */
/* Composite responses                                                 */
/* ------------------------------------------------------------------ */

export interface StormAdvisoryDetail {
  storm: StormAggregate;
  advisory: AdvisoryDetail;
}

/**
 * Storm with a derived risk level, used by the dashboard.
 * Built client-side from the dashboard summary response.
 */
export interface DashboardStorm extends StormAggregate {
  riskLevel: StormRiskLevel;
}

/* ------------------------------------------------------------------ */
/* Warnings                                                            */
/* ------------------------------------------------------------------ */

export interface WarningFeature {
  type: "Feature";
  properties: { warningType: string };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface WarningsFeatureCollection {
  type: "FeatureCollection";
  features: WarningFeature[];
}

/* ------------------------------------------------------------------ */
/* Query params                                                        */
/* ------------------------------------------------------------------ */

export interface StormsQuery {
  tab: StormsTab;
  q?: string;
  sort?: StormsSort;
  basin?: string;
  cat?: string;
  yearFrom?: number;
  yearTo?: number;
}
