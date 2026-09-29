import { useCallback, useEffect, useState } from "react";
import { Polyline, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBounds, LatLngExpression } from "leaflet";

type LngLat = [number, number];

/**
 * Grid spacing in degrees, one entry per integer zoom level.
 *
 * The halving is the point. `leaflet-auto-graticule` picked its step by walking a
 * fixed list of "nice" numbers until one kept lines at least `minDistance`
 * pixels apart, which meant several consecutive zoom levels could resolve to the
 * same divisor: zoom in a step and the grid looked frozen. Here every level
 * halves, so the spacing always changes when the zoom does.
 */
const STEP_BY_ZOOM: Record<number, number> = {
  0: 30,
  1: 30,
  2: 20,
  3: 10,
  4: 5,
  5: 2,
  6: 1,
  7: 0.5,
  8: 0.25,
  9: 0.1,
  10: 0.05,
  11: 0.02,
  12: 0.01,
  13: 0.005,
  14: 0.002,
  15: 0.001,
  16: 0.0005,
  17: 0.0002,
  18: 0.0001,
  19: 0.00005,
};

/** Web Mercator tears at the poles, so the grid stops short of them. */
const MAX_LAT = 85;
const MAX_LNG = 180;

/** Guards against a pathological bounds/step combination emitting a huge DOM. */
const MAX_LINES = 120;

/**
 * Swept against the rendered map, not reasoned about in the abstract.
 *
 * The first guess was slate-500 at 45% and 0.75px. Over OSM land that blends to
 * 1.74:1 on paper and measures about 1.5:1 on screen, because a sub-pixel stroke
 * is spread across its single pixel by antialiasing and no pixel ever reaches
 * the nominal colour. It was too faint to do its job.
 *
 * Weight turned out to matter more than opacity: at 0.75px every opacity change
 * was nearly invisible, because the line never fills a pixel. Measured means
 * over the graticule, sweeping on the live map:
 *
 *     #475569 0.75/0.75 -> 1.77:1     #334155 1.25/0.85 -> 2.39:1
 *     #475569 1.25/0.85 -> 2.07:1     #334155 1.50/0.90 -> 2.88:1
 *     #334155 1.00/1.00 -> 2.10:1     #1E293B 1.50/0.90 -> 3.67:1
 *
 * 1.25px is the knee: past it the graticule starts competing with the 3px track
 * polyline, and slate-800 is close enough to the track's navy that the two are
 * easy to confuse. The 3:1 guideline covers graphical objects needed to
 * understand the content; the graticule is a supplementary reference, and what
 * it does need is to be actually visible, which it now is.
 */
const PATH_OPTIONS = {
  color: "#334155",
  weight: 1.25,
  opacity: 0.9,
  interactive: false,
} as const;

function stepFor(zoom: number): number {
  return STEP_BY_ZOOM[Math.round(zoom)] ?? 0.1;
}

/** First multiple of `step` at or after `from`, nudged off float dust. */
function firstMultiple(from: number, step: number): number {
  return Math.ceil(round6(from / step)) * step;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function collectLines(
  bounds: LatLngBounds,
  step: number,
): { key: string; positions: LatLngExpression[] }[] {
  const south = Math.max(bounds.getSouth(), -MAX_LAT);
  const north = Math.min(bounds.getNorth(), MAX_LAT);
  const west = Math.max(bounds.getWest(), -MAX_LNG);
  const east = Math.min(bounds.getEast(), MAX_LNG);

  if (north <= south || east <= west) return [];

  const lines: { key: string; positions: LatLngExpression[] }[] = [];

  // Meridians: constant longitude, spanning the visible latitude range.
  for (
    let lng = firstMultiple(west, step);
    lng <= east;
    lng = round6(lng + step)
  ) {
    lines.push({
      key: `lng:${lng}`,
      positions: [
        [south, lng],
        [north, lng],
      ],
    });
  }

  // Parallels: constant latitude, spanning the visible longitude range.
  for (
    let lat = firstMultiple(south, step);
    lat <= north;
    lat = round6(lat + step)
  ) {
    lines.push({
      key: `lat:${lat}`,
      positions: [
        [lat, west],
        [lat, east],
      ],
    });
  }

  return lines;
}

/**
 * Lines for the current view, coarsening the step if the bounds would otherwise
 * produce more than MAX_LINES of them.
 *
 * Coarsening rather than truncating matters: a plain cap spends the whole budget
 * on meridians, because those are emitted first, and the grid ends up with
 * vertical lines and no horizontals at all. Widening the spacing keeps both
 * directions present, and a viewport that wide deserves a coarser grid anyway.
 */
function buildLines(
  bounds: LatLngBounds,
  step: number,
): { key: string; positions: LatLngExpression[] }[] {
  let current = step;
  let lines = collectLines(bounds, current);

  while (lines.length > MAX_LINES && current < MAX_LNG) {
    current *= 2;
    lines = collectLines(bounds, current);
  }

  return lines;
}

/**
 * Latitude/longitude grid that redraws for the current zoom.
 *
 * Replaces `leaflet-auto-graticule`, which is unmaintained, ignored zoom when
 * choosing a spacing, and drew with Leaflet's default path style.
 */
export function GraticuleLayer() {
  const map = useMap();
  const [view, setView] = useState<{ zoom: number; bounds: LatLngBounds } | null>(
    null,
  );

  const sync = useCallback(() => {
    setView({ zoom: map.getZoom(), bounds: map.getBounds() });
  }, [map]);

  // zoomend is the one that matters; moveend covers panning and the initial fit.
  useMapEvents({ zoomend: sync, moveend: sync, load: sync });

  // The map may already be positioned when this mounts, in which case none of
  // those events have fired yet.
  useEffect(() => {
    sync();
  }, [sync]);

  if (!view) return null;

  return (
    <>
      {buildLines(view.bounds, stepFor(view.zoom)).map((line) => (
        <Polyline
          key={line.key}
          positions={line.positions}
          pathOptions={PATH_OPTIONS}
        />
      ))}
    </>
  );
}

export { buildLines, stepFor };
export type { LngLat };
