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

/**
 * Full advisory as returned by GET /advisories/:id.
 *
 * Includes the `track` and `cone` geometry columns. The `forecastPoints`
 * and `warnings` relations are added by {@link AdvisoryDetail}.
 */
export interface Advisory {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
  rawText: string | null;
  ingestedAt: string;
  track: { type: "LineString"; coordinates: [number, number][] } | null;
  cone: { type: "Polygon"; coordinates: [number, number][][] } | null;
  /** Populated only by GET /advisories/:id (relation loaded server-side). */
  storm?: Storm;
}

export interface AdvisoryDetail extends Advisory {
  forecastPoints: ForecastPoint[];
  warnings: { id: string; warningType: string }[];
}

/**
 * Lightweight advisory reference returned by GET /storms/:atcfId.
 *
 * Contains only the fields needed to render the advisory card header. The
 * full advisory (forecastPoints, warnings, track, cone, rawText) is
 * fetched on demand from GET /advisories/:id.
 *
 * Does NOT extend {@link Advisory} because `StormDetail.advisories` is a
 * subset of the full advisory. The `Storm` entity's `advisories` relation
 * is typed as the full `Advisory[]`; narrowing it here would be an unsafe
 * override.
 */
export interface AdvisoryRef {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
}

/**
 * Storm plus its lightweight advisory references, returned by
 * GET /storms/:atcfId.
 */
export interface StormDetail extends Storm {
  advisories: AdvisoryRef[];
}

export interface WarningFeature {
  type: "Feature";
  properties: { warningType: string };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface WarningsFeatureCollection {
  type: "FeatureCollection";
  features: WarningFeature[];
}
