import { XMLParser } from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import type { LineString, Polygon, Position } from 'geojson';

/**
 * Parser for NHC KMZ/KML advisory products.
 *
 * NHC publishes advisory geometry as KMZ files. A KMZ is a ZIP archive
 * containing one or more KML documents, typically including:
 *
 * - `…adv_TRACK.kmz` — forecast track polyline(s)
 * - `…adv_CONE.kmz` — cone-of-uncertainty polygon
 * - `…adv_WW.kmz` — coastal watch/warning line segments
 *
 * The relevant KML data is normally represented using:
 *
 * `Document > Folder > Placemark`
 *
 * with geometry such as:
 *
 * - `<LineString>`
 * - `<Polygon>`
 * - `<Point>`
 *
 * and an optional `<ExtendedData>` block containing metadata such as
 * `atcfid` and `advisoryNum`.
 */

/**
 * Metadata commonly attached to an NHC advisory geometry product.
 */
export interface KmzMetadata {
  /**
   * ATCF storm identifier, for example `EP142026`.
   *
   * `null` when the KML does not contain a valid `atcfid`.
   */
  atcfId: string | null;

  /**
   * Advisory number, for example `5`.
   *
   * `null` when the KML does not contain a valid `advisoryNum`.
   */
  advisoryNumber: number | null;
}

/**
 * A loosely typed XML node produced by `fast-xml-parser`.
 *
 * KML has a large and variable schema, so the parser intentionally performs
 * narrow structural checks instead of modeling the entire XML document.
 */
type XmlNode = Record<string, unknown>;

/**
 * A forecast track polyline parsed from a TRACK KMZ.
 */
export interface TrackKml extends KmzMetadata {
  /**
   * The longest valid forecast track line found in the KML.
   *
   * NHC TRACK products may contain multiple forecast lines. The longest
   * LineString represents the most complete forecast track available.
   */
  lineString: LineString;
}

/**
 * The cone-of-uncertainty polygon parsed from a CONE KMZ.
 */
export interface ConeKml extends KmzMetadata {
  /**
   * GeoJSON polygon representing the cone of uncertainty.
   */
  polygon: Polygon;
}

/**
 * One coastal watch/warning segment parsed from a WW KMZ.
 */
export interface WatchWarningSegment {
  /**
   * Watch or warning type, for example `Hurricane Watch`.
   */
  type: string;

  /**
   * GeoJSON LineString describing the affected coastal segment.
   */
  lineString: LineString;
}

/**
 * XML parser configured for NHC KML documents.
 *
 * Attributes are retained because `<Data name="...">` uses the `name`
 * attribute to identify metadata fields.
 *
 * Tag values are intentionally kept as strings because coordinates and
 * metadata require explicit validation before conversion.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',

  // NHC KML documents use default namespaces. Keeping namespace prefixes
  // intact allows the structural search to work without namespace rewriting.
  removeNSPrefix: false,

  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

/**
 * Normalizes an XML value that may occur once or multiple times into an array.
 *
 * This is useful for KML elements such as `<Placemark>` and `<Data>`, which
 * may appear either as a single object or as an array depending on how many
 * instances are present.
 *
 * @param value XML value that may be singular, repeated, null, or undefined.
 * @returns An array containing zero or more values.
 */
function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

/**
 * Recursively collects every XML element whose key exactly matches `suffix`.
 *
 * KML structures can differ between products and advisory versions, so the
 * parser deliberately avoids relying on fixed paths such as
 * `Document.Folder.Placemark`.
 *
 * @param node Current XML node being inspected.
 * @param suffix Element name to collect.
 * @param out Destination array.
 */
function findAll(
  node: unknown,
  suffix: string,
  out: Record<string, unknown>[],
): void {
  if (node === null || typeof node !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === suffix) {
      for (const item of asArray(value)) {
        if (item && typeof item === 'object') {
          out.push(item as Record<string, unknown>);
        }
      }
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        findAll(item, suffix, out);
      }
    } else if (typeof value === 'object' && value !== null) {
      findAll(value, suffix, out);
    }
  }
}

/**
 * Parses a KML coordinate string into GeoJSON positions.
 *
 * KML coordinates use:
 *
 * `longitude,latitude[,altitude]`
 *
 * and individual coordinate tuples are separated by whitespace.
 *
 * Altitude is intentionally discarded because the ingestion model stores
 * two-dimensional GeoJSON geometries.
 *
 * Invalid coordinate tokens are ignored rather than causing the entire KML
 * document to fail. The caller is responsible for checking that enough valid
 * positions remain to construct the requested geometry.
 *
 * @param raw Raw KML `<coordinates>` value.
 * @returns Valid two-dimensional GeoJSON positions.
 */
function parseCoordinates(raw: string): Position[] {
  const positions: Position[] = [];

  for (const token of raw.trim().split(/\s+/)) {
    if (!token) {
      continue;
    }

    const parts = token.split(',');

    // KML requires longitude and latitude. Altitude is optional.
    if (parts.length < 2) {
      continue;
    }

    const lon = Number(parts[0]);
    const lat = Number(parts[1]);

    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      continue;
    }

    positions.push([lon, lat]);
  }

  return positions;
}

/**
 * Reads a Placemark's ExtendedData block.
 *
 * Expected structure:
 *
 * `<ExtendedData>`
 * `  <Data name="...">`
 * `    <value>...</value>`
 * `  </Data>`
 * `</ExtendedData>`
 *
 * Both `<value>` and `#text` are supported because different XML shapes can
 * produce either representation through `fast-xml-parser`.
 *
 * @param node Parsed Placemark.
 * @returns Metadata key/value pairs.
 */
function readExtendedData(node: XmlNode): Record<string, string> {
  const out: Record<string, string> = {};

  const raw = node.ExtendedData as
    | {
        Data?: unknown;
      }
    | undefined;

  if (!raw) {
    return out;
  }

  for (const item of asArray(raw.Data)) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const data = item as {
      '@_name'?: unknown;
      value?: unknown;
      '#text'?: unknown;
    };

    const name = data['@_name'];

    if (typeof name !== 'string' || !name.trim()) {
      continue;
    }

    const value = data.value ?? data['#text'];

    out[name.trim()] =
      value === undefined || value === null ? '' : String(value).trim();
  }

  return out;
}

/**
 * Extracts standard NHC metadata from a Placemark.
 *
 * Invalid or missing metadata is represented by `null` rather than causing
 * geometry parsing to fail.
 *
 * @param node Parsed Placemark.
 * @returns ATCF ID and advisory number metadata.
 */
function readMetadata(node: XmlNode): KmzMetadata {
  const data = readExtendedData(node);

  const atcfId =
    typeof data.atcfid === 'string' && data.atcfid.trim()
      ? data.atcfid.trim()
      : null;

  const rawAdvisoryNumber = data.advisoryNum?.trim() ?? '';
  const advisoryNumber = rawAdvisoryNumber
    ? Number(rawAdvisoryNumber)
    : Number.NaN;

  return {
    atcfId,
    advisoryNumber: Number.isFinite(advisoryNumber) ? advisoryNumber : null,
  };
}

/**
 * Extracts a valid LineString from a Placemark.
 *
 * A LineString requires at least two valid positions.
 *
 * @param placemark Parsed KML Placemark.
 * @returns GeoJSON LineString or `null` when no valid line exists.
 */
function lineStringOf(placemark: XmlNode): LineString | null {
  const line = placemark.LineString as
    | {
        coordinates?: unknown;
      }
    | undefined;

  const coordinates = line?.coordinates;

  if (typeof coordinates !== 'string') {
    return null;
  }

  const positions = parseCoordinates(coordinates);

  if (positions.length < 2) {
    return null;
  }

  return {
    type: 'LineString',
    coordinates: positions,
  };
}

/**
 * Finds the longest valid LineString among a collection of Placemarks.
 *
 * NHC TRACK products can contain multiple LineStrings representing different
 * forecast horizons. Selecting the longest valid line gives the most complete
 * forecast track available in the document.
 *
 * @param placemarks KML Placemarks to inspect.
 * @returns Longest valid LineString, or `null` when none exists.
 */
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
 * Parses a raw KMZ archive and extracts its first KML document.
 *
 * A KMZ is a ZIP archive containing one or more KML files. Directory entries
 * and non-KML files are ignored.
 *
 * @param kmz Raw KMZ bytes.
 * @returns UTF-8 decoded KML document.
 *
 * @throws {TypeError} When the supplied value is not a Buffer.
 * @throws {Error} When the archive is invalid or contains no KML entry.
 */
export function parseKmz(kmz: Buffer): string {
  if (!Buffer.isBuffer(kmz)) {
    throw new TypeError('KMZ input must be a Buffer');
  }

  if (kmz.length === 0) {
    throw new Error('KMZ archive is empty');
  }

  let zip: AdmZip;

  try {
    zip = new AdmZip(kmz);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown ZIP error';

    throw new Error(`Unable to read KMZ archive: ${message}`, {
      cause: error,
    });
  }

  const entry = zip.getEntries().find((candidate) => {
    return !candidate.isDirectory && /\.kml$/i.test(candidate.entryName.trim());
  });

  if (!entry) {
    throw new Error('KMZ archive contains no KML entry');
  }

  return entry.getData().toString('utf8');
}

/**
 * Parses a TRACK KMZ's KML into its forecast track.
 *
 * The parser searches all Placemarks for valid LineStrings and selects the
 * longest one. This accommodates NHC products containing multiple forecast
 * horizons.
 *
 * @param kml KML document text.
 * @returns Parsed track and metadata, or `null` when no valid track exists.
 *
 * @throws {Error} When the supplied KML cannot be parsed as XML.
 */
export function parseTrackKml(kml: string): TrackKml | null {
  if (!kml || !kml.trim()) {
    return null;
  }

  const doc = parser.parse(kml) as XmlNode;

  const placemarks: XmlNode[] = [];
  findAll(doc, 'Placemark', placemarks);

  const lineString = firstLineString(placemarks);

  if (!lineString) {
    return null;
  }

  /**
   * Prefer metadata from the Placemark carrying the selected longest line.
   * This avoids accidentally returning metadata from an unrelated Placemark
   * when a TRACK document contains multiple entries.
   */
  const selectedPlacemark = placemarks.find((placemark) => {
    const line = lineStringOf(placemark);

    return (
      line !== null && line.coordinates.length === lineString.coordinates.length
    );
  });

  const metadata = readMetadata(selectedPlacemark ?? {});

  return {
    ...metadata,
    lineString,
  };
}

/**
 * Parses a CONE KMZ's KML into a cone-of-uncertainty polygon.
 *
 * The NHC normally publishes a single outer boundary. The parser searches
 * all Placemarks and returns the first valid outer ring.
 *
 * A valid ring must contain at least four positions, including the closing
 * position required by GeoJSON polygon semantics.
 *
 * @param kml KML document text.
 * @returns Parsed cone and metadata, or `null` when no valid polygon exists.
 *
 * @throws {Error} When the supplied KML cannot be parsed as XML.
 */
export function parseConeKml(kml: string): ConeKml | null {
  if (!kml || !kml.trim()) {
    return null;
  }

  const doc = parser.parse(kml) as XmlNode;

  const placemarks: XmlNode[] = [];
  findAll(doc, 'Placemark', placemarks);

  for (const placemark of placemarks) {
    const polygon = placemark.Polygon as
      | {
          outerBoundaryIs?: unknown;
        }
      | undefined;

    const outerBoundary = polygon?.outerBoundaryIs as
      | {
          LinearRing?: unknown;
        }
      | undefined;

    const linearRing = outerBoundary?.LinearRing as
      | {
          coordinates?: unknown;
        }
      | undefined;

    const coordinates = linearRing?.coordinates;

    if (typeof coordinates !== 'string') {
      continue;
    }

    const positions = parseCoordinates(coordinates);

    // GeoJSON linear rings require at least four positions, with the first
    // and last positions representing the same coordinate.
    if (positions.length < 4) {
      continue;
    }

    const first = positions[0];
    const last = positions[positions.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      continue;
    }

    return {
      ...readMetadata(placemark),
      polygon: {
        type: 'Polygon',
        coordinates: [positions],
      },
    };
  }

  return null;
}

/**
 * Parses a WW KMZ's KML into coastal watch/warning segments.
 *
 * Every qualifying Placemark must contain:
 *
 * - a non-empty `<name>`
 * - a valid LineString containing at least two positions
 *
 * Placemarks without valid geometry or without a meaningful name are ignored.
 *
 * @param kml KML document text.
 * @returns All valid coastal watch/warning segments found in the document.
 *
 * @throws {Error} When the supplied KML cannot be parsed as XML.
 */
export function parseWatchWarningsKml(kml: string): WatchWarningSegment[] {
  if (!kml || !kml.trim()) {
    return [];
  }

  const doc = parser.parse(kml) as XmlNode;

  const placemarks: XmlNode[] = [];
  findAll(doc, 'Placemark', placemarks);

  const segments: WatchWarningSegment[] = [];

  for (const placemark of placemarks) {
    if (typeof placemark.name !== 'string' || !placemark.name.trim()) {
      continue;
    }

    const lineString = lineStringOf(placemark);

    if (!lineString) {
      continue;
    }

    segments.push({
      type: placemark.name.trim(),
      lineString,
    });
  }

  return segments;
}
