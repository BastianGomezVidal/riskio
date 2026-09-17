export interface Storm {
  atcfId: string;
  name: string | null;
  basin: string;
  lastSeenAt: string;
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
  /** Populated only by GET /advisories/:id (relation loaded server-side). */
  storm?: Storm;
}

export interface AdvisoryDetail extends Advisory {
  forecastPoints: ForecastPoint[];
  warnings: { id: string; warningType: string }[];
}

export interface StormDetail extends Storm {
  advisories: Advisory[];
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