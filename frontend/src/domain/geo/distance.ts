import { REFERENCE_CITIES, type ReferenceCity } from "./reference-cities";

const EARTH_RADIUS_MILES = 3958.7613;
const MAX_REFERENCE_DISTANCE_MILES = 3000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

export function initialBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const CARDINALS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export function cardinalDirection(bearing: number): string {
  const index = Math.round(bearing / 22.5) % 16;
  return CARDINALS[index];
}

export function nearestReference(
  lat: number,
  lon: number,
): { city: ReferenceCity; distanceMi: number; bearing: number } | null {
  let best: ReferenceCity | null = null;
  let bestDistance = Infinity;

  for (const city of REFERENCE_CITIES) {
    const d = haversineMiles(lat, lon, city.lat, city.lon);
    if (d < bestDistance) {
      bestDistance = d;
      best = city;
    }
  }

  if (!best || bestDistance > MAX_REFERENCE_DISTANCE_MILES) {
    return null;
  }

  return {
    city: best,
    distanceMi: bestDistance,
    bearing: initialBearing(lat, lon, best.lat, best.lon),
  };
}

export function describeLocation(lat: number, lon: number): string | null {
  const ref = nearestReference(lat, lon);
  if (!ref) return null;

  const direction = cardinalDirection(ref.bearing);
  const distance = Math.round(ref.distanceMi / 10) * 10;
  return `~${distance.toLocaleString()} mi ${direction} of ${ref.city.name}`;
}
