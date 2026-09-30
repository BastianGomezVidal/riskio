import { XMLParser } from 'fast-xml-parser';
import type { ForecastPointDto } from '../../../common/contracts/forecast-point.dto.js';

/**
 * Parser for NOAA NHC feeds.
 *
 * Turns raw NHC RSS/XML into typed structures:
 *  - {@link parseRssFeed} decodes the generic RSS envelope,
 *  - {@link extractStormSummaries} picks active storms out of the feeds,
 *  - {@link parseForecastPoints} reads the forecast track points of a TCM
 *    advisory from its CDATA block.
 */

/** Cyclone metadata parsed from an item's `nhc:Cyclone` element. */
export interface CycloneInfo {
  atcfId: string;
  wallet: string;
  name: string | null; // null if unnamed (e.g. "Fourteen-E")
  stormType: string;
  latitude: number;
  longitude: number;
  pressureMb: number | null;
  windKt: number | null;
  headline: string | null;
}

/** One RSS `<item>` from a feed, normalized and typed. */
export interface RssItem {
  title: string;
  description: string | null;
  pubDate: Date | null;
  link: string | null;
  guid: string | null;
  cyclone: CycloneInfo | null;
  /**
   * True when the item carried an `nhc:Cyclone` element, valid or not.
   *
   * Informational items (tropical weather outlooks, "no storms" notices)
   * omit the element entirely. A present-but-invalid element therefore
   * signals a payload/format change rather than a genuinely quiet basin.
   */
  hasCycloneElement: boolean;
}

/** A parsed RSS document: feed metadata plus its normalized items. */
export interface ParsedFeed {
  channelTitle: string;
  channelPubDate: Date | null;
  items: RssItem[];
}

/** A single forecast track point, as produced by {@link parseForecastPoints}. */
/**
 * Title patterns that mean "no active storm" in a feed.
 * First matches wallet/area feeds, second matches basin summaries.
 */
const SENTINEL_PATTERNS = [
  /No current storm/i,
  /no tropical cyclones at this time/i,
];

const MPH_TO_KT = 0.868976;

// XML parser options
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  // Important: preserve the nhc: namespace prefix on tag names
  removeNSPrefix: false,
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * One node of the parsed XML tree.
 *
 * `XMLParser.parse` is declared as returning `any`, and letting that `any`
 * reach the mapping below is what produced 29 unsafe-member-access findings in
 * this file: every `raw['nhc:...']` was unchecked. The tree is genuinely
 * untyped — namespaced keys, `#text` for mixed content, and no schema — so the
 * honest boundary is `Record<string, unknown>` plus narrowing at each read,
 * rather than `any` and hope.
 */
type XmlNode = Record<string, unknown>;

/** Narrows an untyped parsed value to an object node, or undefined. */
function asNode(value: unknown): XmlNode | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as XmlNode)
    : undefined;
}

/**
 * Reads a repeated element as a list of nodes. A feed may give one `<item>` or
 * many, and may also give something that is not an element at all, which is
 * dropped rather than passed on as `any`.
 */
function nodes(value: unknown): XmlNode[] {
  return toArray(value)
    .map(asNode)
    .filter((node): node is XmlNode => node !== undefined);
}

/**
 * Reads an element as text. A number or boolean becomes its string form, and
 * anything that is not a primitive — a nested element, an array, null —
 * becomes ''. This replaces `String(value ?? '')`, which on an `unknown` would
 * store "[object Object]" as if it were the element's text.
 */
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCenter(raw: unknown): { lat: number; lon: number } | null {
  if (typeof raw !== 'string') return null;
  // "16.4, -116.6"
  const m = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { lat: Number(m[1]), lon: Number(m[2]) };
}

function parsePressureMb(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  // "1006 mb"
  const m = raw.match(/(\d+)\s*mb/i);
  return m ? Number(m[1]) : null;
}

function parseWindKt(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  // "35 mph"  (or "35 kt")
  const m = raw.match(/(\d+)\s*(mph|kt)/i);
  if (!m) return null;
  const value = Number(m[1]);
  return m[2].toLowerCase() === 'mph' ? Math.round(value * MPH_TO_KT) : value;
}

/**
 * A storm name like "Fourteen-E" is a designation, not a real name.
 * Real names are proper nouns: "Lowell", "Milton", "Sara".
 */
function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const name = raw.trim();
  // Designation patterns: "One", "Fourteen-E", "Twenty-Two"
  if (
    /^(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Twenty-One|Twenty-Two|Twenty-Three)(-[A-Z])?$/i.test(
      name,
    )
  ) {
    return null;
  }
  return name;
}

function isSentinelTitle(title: string): boolean {
  return SENTINEL_PATTERNS.some((p) => p.test(title));
}

/**
 * Parse a generic RSS document into a typed {@link ParsedFeed}.
 *
 * @throws Error when the document has no `rss.channel` (not RSS).
 */
export function parseRssFeed(xml: string): ParsedFeed {
  const root = asNode(parser.parse(xml));
  const rss = asNode(root?.['rss']);
  const channel = asNode(rss?.['channel']);
  if (!channel) {
    throw new Error('Not a valid RSS document: missing rss.channel');
  }

  const items = nodes(channel['item']).map((raw): RssItem => {
    const nhcCyclone = asNode(raw['nhc:Cyclone']);
    let cyclone: CycloneInfo | null = null;

    if (nhcCyclone) {
      const center = parseCenter(nhcCyclone['nhc:center']);
      const atcfId = text(nhcCyclone['nhc:atcf']);
      const wallet = text(nhcCyclone['nhc:wallet']);

      // Only build a CycloneInfo if we have the two critical IDs
      if (atcfId && wallet && center) {
        const headline = text(nhcCyclone['nhc:headline']);
        cyclone = {
          atcfId,
          wallet,
          name: normalizeName(nhcCyclone['nhc:name']),
          stormType: text(nhcCyclone['nhc:type']),
          latitude: center.lat,
          longitude: center.lon,
          pressureMb: parsePressureMb(nhcCyclone['nhc:pressure']),
          windKt: parseWindKt(nhcCyclone['nhc:wind']),
          headline: headline ? headline : null,
        };
      }
    }

    // <guid> is either text or an element with a #text child, depending on
    // whether the feed includes an isPermaLink attribute. An element that is
    // present but has no #text keeps '' rather than becoming null: absent and
    // empty are different, and the distinction is asserted.
    const guidNode = raw['guid'];
    const guidElement = asNode(guidNode);
    const guid = guidElement
      ? text(guidElement['#text'])
      : guidNode === undefined
        ? null
        : text(guidNode) || null;

    return {
      title: text(raw['title']),
      description: text(raw['description']) || null,
      pubDate: parseDate(raw['pubDate']),
      link: text(raw['link']) || null,
      guid,
      cyclone,
      hasCycloneElement: Boolean(nhcCyclone),
    };
  });

  return {
    channelTitle: text(channel['title']),
    channelPubDate: parseDate(channel['pubDate']),
    items,
  };
}

/** A storm in an active state, derived from one RSS item's cyclone data. */
export interface StormSummary {
  atcfId: string;
  basin: string; // "EP", "AL", "CP" — derived from ATCF prefix
  name: string | null;
  stormType: string;
  wallet: string;
  issuedAt: Date;
  headline: string | null;
}

/**
 * Extract the active storm summaries from a parsed feed.
 *
 * Items are skipped when their title matches a "no storm" sentinel, when no
 * cyclone metadata could be parsed, or when no issue date is present.
 */
export function extractStormSummaries(feed: ParsedFeed): StormSummary[] {
  const out: StormSummary[] = [];

  for (const item of feed.items) {
    if (isSentinelTitle(item.title)) continue;
    if (!item.cyclone) continue;
    if (!item.pubDate) continue;

    // Basin = first two letters of ATCF ID (AL, EP, CP, WP, IO, SH)
    const basin = item.cyclone.atcfId.slice(0, 2);

    out.push({
      atcfId: item.cyclone.atcfId,
      basin,
      name: item.cyclone.name,
      stormType: item.cyclone.stormType,
      wallet: item.cyclone.wallet,
      issuedAt: item.pubDate,
      headline: item.cyclone.headline,
    });
  }

  return out;
}

/**
 * Parses the CDATA text of a TCM advisory (e.g. TCMEP4.xml) and extracts
 * each FORECAST VALID / OUTLOOK VALID point.
 *
 * Example block:
 *   FORECAST VALID 10/1200Z 16.7N 118.5W
 *   MAX WIND  35 KT...GUSTS  45 KT.
 */
export function parseForecastPoints(
  cdata: string,
  referenceDate: Date,
): ForecastPointDto[] {
  const out: ForecastPointDto[] = [];
  const lines = cdata.split(/(?:\r?\n|<br\s*\/?>)+/i);

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth(); // 0-based
  const refDay = referenceDate.getUTCDate();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const validMatch = line.match(
      /(?:FORECAST|OUTLOOK)\s+VALID\s+(\d{2})\/(\d{2})(\d{2})Z\s+(\d+(?:\.\d+)?)([NS])\s+(\d+(?:\.\d+)?)([EW])/i,
    );
    if (!validMatch) continue;

    const [, dd, hh, mm, latRaw, latHemi, lonRaw, lonHemi] = validMatch;

    // Year: assume current year. NOAA advisories don't include year.
    const day = Number(dd);
    const hour = Number(hh);
    const minute = Number(mm);

    // If the forecast day is less than the reference day, we've rolled
    // into the next calendar month.
    let validYear = refYear;
    let validMonth = refMonth;
    if (day < refDay) {
      validMonth += 1;
      if (validMonth > 11) {
        validMonth = 0;
        validYear += 1;
      }
    }

    const validAt = new Date(
      Date.UTC(validYear, validMonth, day, hour, minute),
    );
    // Note: month/day parsing here is approximate; we refine below using the
    // current advisory date to pick the right month.

    let lat = Number(latRaw);
    let lon = Number(lonRaw);
    if (latHemi.toUpperCase() === 'S') lat = -lat;
    if (lonHemi.toUpperCase() === 'W') lon = -lon;

    // Look ahead up to 3 lines for MAX WIND
    let windSpeedKt: number | null = null;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const windMatch = lines[j].match(/MAX\s+WIND\s+(\d+)\s*KT/i);
      if (windMatch) {
        windSpeedKt = Number(windMatch[1]);
        break;
      }
    }

    out.push({
      validAt,
      latitude: lat,
      longitude: lon,
      windSpeedKt,
      pressureMb: null, // TCM advisories don't include forecast pressure
      category: null, // we'll compute later from windSpeedKt
    });
  }

  return out;
}
