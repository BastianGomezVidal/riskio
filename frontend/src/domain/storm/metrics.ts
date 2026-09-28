import type { ForecastPoint } from "../../domain/storm/interfaces";
import type { StormRiskLevel } from "../../domain/storm/types";

/**
 * Risk level of a single advisory, derived from its forecast points.
 *
 * Distinct from the storm-level risk computed by the backend for the
 * dashboard: this one is local and refers only to the advisory being
 * viewed.
 */
export function advisoryRiskLevel(points: ForecastPoint[]): StormRiskLevel {
  const max = points.reduce<number>(
    (m, p) => Math.max(m, p.category ?? -1),
    -1,
  );
  if (max >= 3) return "high";
  if (max === 2) return "moderate";
  return "low";
}

export function maxWinds(points: ForecastPoint[]): number | null {
  const values = points
    .map((p) => p.windSpeedKt)
    .filter((n): n is number => n != null);
  return values.length ? Math.max(...values) : null;
}

export function movement(points: ForecastPoint[]): {
  text: string;
  bearing: number;
} {
  if (points.length < 2) return { text: "Stationary", bearing: 0 };

  const [a, b] = [points[0], points[1]];
  const latRad = (a.latitude * Math.PI) / 180;
  const dx = (b.longitude - a.longitude) * Math.cos(latRad) * 60;
  const dy = (b.latitude - a.latitude) * 60;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  const bearing = (deg + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dir = dirs[Math.round(bearing / 45) % 8];
  const knots = Math.hypot(dx, dy);
  return { text: `${dir} ${Math.round(knots)} kt`, bearing };
}

export function stormType(points: ForecastPoint[]): string {
  const cat = points[0]?.category;
  if (cat == null || cat === 0) return "Tropical Storm";
  return "Hurricane";
}
