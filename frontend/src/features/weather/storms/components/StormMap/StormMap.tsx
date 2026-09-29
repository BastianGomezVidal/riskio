import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  CircleMarker,
} from "react-leaflet";
// Scoped here rather than imported globally in main.tsx: it was 6.7 kB gzipped
// of render-blocking CSS on the login page and the dashboard, neither of which
// ever shows a map.
import type { LatLngBoundsExpression } from "leaflet";
import { GraticuleLayer } from "./GraticulateLayer";

type LngLat = [number, number];

/**
 * Zoom floor. Below roughly this the world is narrower than the map, which is
 * what exposed the tiled world's left edge in the first place.
 */
const MIN_ZOOM = 3;

/** Keeps panning inside one copy of the world, matching the graticule clamp. */
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
];

interface WarningSegment {
  id: string;
  warningType: string;
  geometry: { type: "LineString"; coordinates: [number, number][] } | null;
}

interface Props {
  track: { type: "LineString"; coordinates: [number, number][] } | null;
  cone: { type: "Polygon"; coordinates: [number, number][][] } | null;
  warnings?: WarningSegment[];
  height?: number;
}

/**
 * Palette shared by the warning tags and the warning lines, so a segment and
 * its tag in the card below always read as the same warning.
 */
const WARNING_COLORS: Record<string, string> = {
  red: "#dc2626",
  volcano: "#7c3aed",
  orange: "#ea580c",
  gold: "#ca8a04",
};

export function warningColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("hurricane") && t.includes("warning")) return "red";
  if (t.includes("hurricane") && t.includes("watch")) return "volcano";
  if (t.includes("warning")) return "orange";
  return "gold";
}

export function StormMap({ track, cone, warnings = [], height = 340 }: Props) {
  const trackPoints = useMemo<LngLat[]>(
    () => (track?.coordinates ?? []) as LngLat[],
    [track],
  );

  const coneRing = useMemo<LngLat[]>(
    () => (cone?.coordinates[0] ?? []) as LngLat[],
    [cone],
  );

  if (trackPoints.length === 0 && coneRing.length === 0) {
    return null;
  }

  // The warning segments have to be part of the viewport, not just drawn on
  // it. They follow the coastline, which can sit well away from the storm
  // centre, and a line outside the bounds is simply not on screen.
  const warningPoints = warnings
    .flatMap((warning) => warning.geometry?.coordinates ?? [])
    .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2);

  const bounds = computeBounds([...trackPoints, ...coneRing, ...warningPoints]);
  const start = trackPoints[0];
  const current = trackPoints[trackPoints.length - 1];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [32, 32] }}
      minZoom={MIN_ZOOM}
      maxBounds={WORLD_BOUNDS}
      style={{ height, borderRadius: 8, zIndex: 0 }}
      scrollWheelZoom={false}
      aria-hidden="true"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        subdomains={["a", "b", "c"]}
        maxZoom={19}
        // Leaflet repeats the world horizontally by default, so zooming out far
        // enough to cover more than one world width shows the continents twice:
        // two Europes, two Africas. Nothing here is ever worth that view, since
        // the bounds are a single storm, and `noWrap` plus a zoom floor and a
        // world max bound make it unreachable rather than merely discouraged.
        noWrap
      />

      <GraticuleLayer />

      {coneRing.length > 0 && (
        <Polygon
          positions={coneRing.map(([lng, lat]) => [lat, lng])}
          pathOptions={{
            color: "#c2410c",
            weight: 1,
            fillColor: "#fb923c",
            fillOpacity: 0.18,
          }}
        />
      )}

      {trackPoints.length > 0 && (
        <Polyline
          positions={trackPoints.map(([lng, lat]) => [lat, lng])}
          pathOptions={{ color: "#1e3a8a", weight: 3 }}
        />
      )}

      {warnings.map((warning) => {
        const points = warning.geometry?.coordinates ?? [];
        if (points.length < 2) return null;
        return (
          <Polyline
            key={warning.id}
            positions={points.map(([lng, lat]) => [lat, lng])}
            pathOptions={{
              color: WARNING_COLORS[warningColor(warning.warningType)],
              weight: 4,
              opacity: 0.85,
            }}
          />
        );
      })}

      {start && (
        <CircleMarker
          center={[start[1], start[0]]}
          radius={6}
          pathOptions={{
            color: "#1e3a8a",
            weight: 2,
            fillColor: "#ffffff",
            fillOpacity: 1,
          }}
        />
      )}

      {current && current !== start && (
        <CircleMarker
          center={[current[1], current[0]]}
          radius={6}
          pathOptions={{
            color: "#1e3a8a",
            weight: 2,
            fillColor: "#1e3a8a",
            fillOpacity: 1,
          }}
        />
      )}
    </MapContainer>
  );
}

function computeBounds(points: LngLat[]): LatLngBoundsExpression {
  if (points.length === 0) {
    return [
      [0, 0],
      [0, 0],
    ];
  }

  let minLat = points[0][1];
  let maxLat = points[0][1];
  let minLng = points[0][0];
  let maxLng = points[0][0];

  for (const [lng, lat] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  if (minLat === maxLat) {
    minLat -= 0.1;
    maxLat += 0.1;
  }
  if (minLng === maxLng) {
    minLng -= 0.1;
    maxLng += 0.1;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
