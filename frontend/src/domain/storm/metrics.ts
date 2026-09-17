import type { ForecastPoint, Storm } from "./types";

export type RiskLevel = "high" | "watch" | "moderate" | "low";

export function riskLevel(points: ForecastPoint[]): RiskLevel {
  const max = points.reduce<number>(
    (m, p) => Math.max(m, p.category ?? -1),
    -1,
  );
  if (max >= 3) return "high";
  if (max === 2) return "watch";
  if (max === 1) return "moderate";
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
  const dx = b.longitude - a.longitude;
  const dy = b.latitude - a.latitude;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  const bearing = (deg + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dir = dirs[Math.round(bearing / 45) % 8];
  const knots = Math.hypot(dx, dy) * 60;
  return { text: `${dir} ${Math.round(knots)} kt`, bearing };
}

export function stormType(points: ForecastPoint[]): string {
  const cat = points[0]?.category;
  if (cat == null || cat === 0) return "Tropical Storm";
  return "Hurricane";
}

export function aceIndex(storms: Array<{ points: ForecastPoint[] }>): number {
  let ace = 0;
  for (const s of storms) {
    for (const p of s.points) {
      if (p.windSpeedKt != null && p.windSpeedKt >= 34) {
        ace += (p.windSpeedKt * p.windSpeedKt) / 10_000;
      }
    }
  }
  return ace;
}

/** Count of storms that have a non-null name. */
export function countNamed(storms: Storm[]): number {
  return storms.filter((s) => s.name != null).length;
}