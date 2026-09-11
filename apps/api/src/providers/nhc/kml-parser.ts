import { XMLParser } from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import type { LineString, Polygon, Position } from 'geojson';

/**
 * Parser for NHC KMZ/KML advisory products.
 *
 * NHC publishes each advisory's geometry as KMZ files (a ZIP archive whose
 * entry of interest is a single `.kml` document):
 *  - `…adv_TRACK.kmz` — forecast track polyline(s)
 *  - `…adv_CONE.kmz`  — cone-of-uncertainty polygon
 *  - `…adv_WW.kmz`    — coastal watch/warning line segments (only when a
 *    storm carries coastal watches/warnings)
 *
 * The `Document > Folder > Placemark` structure carries a `<LineString>`,
 * `<Polygon>` or `<Point>` plus an `<ExtendedData>` block of attributes such as
 * `atcfid` and `advisoryNum`.
 */

export interface KmzMetadata {
  atcfId: string | null;
  advisoryNumber: number | null;
}

/** A loosely-typed parsed KML node, as produced by fast-xml-parser. */
type XmlNode = Record<string, unknown>;

/** A forecast track polyline parsed from a TRACK KMZ. */
export interface TrackKml extends KmzMetadata {
  /** The longest forecast track line found (the 120-hour line when present). */
  lineString: LineString;
}

/** The cone-of-uncertainty polygon parsed from a CONE KMZ. */
export interface ConeKml extends KmzMetadata {
  polygon: Polygon;
}

/** One coastal watch/warning segment parsed from a WW KMZ. */
export interface WatchWarningSegment {
  /** The watch/warning type, e.g. "Hurricane Watch". */
  type: string;
  lineString: LineString;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // NHC's KML files use a default namespace (no `kml:` prefix on tags);
  // stripping it trips fast-xml-parser when a `<?xml?>` declaration precedes
  // the root element, so the prefix is left untouched instead.
  removeNSPrefix: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Recursively collect every element whose key ends in `suffix` (e.g. all
 * `Placemark`s, wherever they are nested). The KML layout differs between
 * products, so a structural walk is more robust than fixed paths.
 */
function findAll(
  node: unknown,
  suffix: string,
  out: Record<string, unknown>[],
): void {
  if (node === null || typeof node !== 'object') return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === suffix)
      out.push(...(asArray(value) as Record<string, unknown>[]));
    if (Array.isArray(value)) {
      for (const item of value) findAll(item, suffix, out);
    } else if (typeof value === 'object' && value !== null) {
      findAll(value, suffix, out);
    }
  }
}

/** Parse a "lon,lat,alt lon,lat,alt …" string into GeoJSON positions (no altitude). */
function parseCoordinates(raw: string): Position[] {
  return (
    raw
      .trim()
      // Tokens may be separated by any whitespace (including newlines).
      .split(/\s+/)
      .filter(Boolean)
      .map((token): Position | null => {
        const parts = token.split(',');
        if (parts.length < 2) return null;
        const lon = Number(parts[0]);
        const lat = Number(parts[1]);
        return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
      })
      .filter((p): p is Position => p !== null)
  );
}

/** Read a Placemark's `<ExtendedData><Data name="…"><value>…</value></Data>` block. */
function readExtendedData(node: XmlNode): Record<string, string> {
  const out: Record<string, string> = {};
  const raw: { Data?: unknown } | undefined = node.ExtendedData as
    { Data?: unknown } | undefined;
  if (!raw) return out;
  for (const item of asArray<unknown>(raw.Data)) {
    const data = item as {
      '@_name'?: unknown;
      value?: unknown;
      '#text'?: unknown;
    } | null;
    if (!data || typeof data !== 'object') continue;
    const name = data['@_name'];
    if (typeof name !== 'string' || !name) continue;
    const value = data.value ?? data['#text'];
    out[name] = value === undefined ? '' : String(value).trim();
  }
  return out;
}

function readMetadata(node: XmlNode): KmzMetadata {
  const data = readExtendedData(node);
  const advisoryNumber = data.advisoryNum ? Number(data.advisoryNum) : null;
  return {
    atcfId: data.atcfid ? String(data.atcfid) : null,
    advisoryNumber: Number.isFinite(advisoryNumber as number)
      ? advisoryNumber
      : null,
  };
}

function lineStringOf(placemark: XmlNode): LineString | null {
  const line: { coordinates?: unknown } | undefined = placemark.LineString as
    { coordinates?: unknown } | undefined;
  const coords = line?.coordinates;
  if (typeof coords !== 'string') return null;

  const positions = parseCoordinates(coords);
  if (positions.length < 2) return null;
  return { type: 'LineString', coordinates: positions };
}

function firstLineString(placemarks: XmlNode[]): LineString | null {
  let best: LineString | null = null;
  for (const placemark of placemarks) {
    const line = lineStringOf(placemark);
    if (line && (!best || line.coordinates.length > best.coordinates.length)) {
      best = line;
    }
  }
  return best;
}

/**
 * Decompress a KMZ archive and return its KML document text.
 *
 * @param kmz raw KMZ bytes (ZIP archive containing a `.kml` entry).
 * @throws Error when the archive has no `.kml` entry.
 */
export function parseKmz(kmz: Buffer): string {
  const zip = new AdmZip(kmz);
  const entry = zip
    .getEntries()
    .find((e) => !e.isDirectory && /\.kml$/i.test(e.entryName));
  if (!entry) {
    throw new Error('KMZ archive contains no KML entry');
  }
  return entry.getData().toString('utf8');
}

/**
 * Parse a TRACK KMZ's KML into its forecast track polyline.
 *
 * The longest `LineString` in the "Forecast Track" folder is the 120-hour
 * forecast track; shorter lines (e.g. 72 hours) are supersets subsets of it.
 *
 * @returns the parsed track and metadata, or `null` when no track line exists.
 */
export function parseTrackKml(kml: string): TrackKml | null {
  const doc = parser.parse(kml) as XmlNode;
  const placemarks: XmlNode[] = [];
  findAll(doc, 'Placemark', placemarks);

  const lineString = firstLineString(placemarks);
  if (!lineString) return null;

  const metadata = readMetadata(placemarks[0] ?? {});
  return { ...metadata, lineString };
}

/**
 * Parse a CONE KMZ's KML into its cone-of-uncertainty polygon.
 *
 * NHC publishes a single-Placemark document with one outer ring.
 *
 * @returns the parsed polygon and metadata, or `null` when none exists.
 */
export function parseConeKml(kml: string): ConeKml | null {
  const doc = parser.parse(kml) as XmlNode;
  const placemarks: XmlNode[] = [];
  findAll(doc, 'Placemark', placemarks);

  for (const placemark of placemarks) {
    const polygon: { outerBoundaryIs?: unknown } | undefined =
      placemark.Polygon as { outerBoundaryIs?: unknown } | undefined;
    const ring: { LinearRing?: { coordinates?: unknown } } | undefined =
      polygon?.outerBoundaryIs as
        { LinearRing?: { coordinates?: unknown } } | undefined;
    const coords = ring?.LinearRing?.coordinates;
    if (typeof coords !== 'string') continue;

    const positions = parseCoordinates(coords);
    if (positions.length < 4) continue;

    return {
      ...readMetadata(placemark),
      polygon: { type: 'Polygon', coordinates: [positions] },
    };
  }
  return null;
}

/**
 * Parse a WW KMZ's KML into its coastal watch/warning segments.
 *
 * Each `<Placemark>` carries a `<name>` (e.g. "Hurricane Watch") and a
 * `<LineString>` along the affected coastline.
 */
export function parseWatchWarningsKml(kml: string): WatchWarningSegment[] {
  const doc = parser.parse(kml) as XmlNode;
  const placemarks: XmlNode[] = [];
  findAll(doc, 'Placemark', placemarks);

  const segments: WatchWarningSegment[] = [];
  for (const placemark of placemarks) {
    if (typeof placemark.name !== 'string' || !placemark.name.trim()) continue;

    const line = lineStringOf(placemark);
    if (!line) continue;

    segments.push({
      type: placemark.name.trim(),
      lineString: line,
    });
  }
  return segments;
}
