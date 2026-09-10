import { XMLParser } from 'fast-xml-parser';

// ─────────────────────────────────────────────────────────────
// Public types — these are the contract of the parser
// ─────────────────────────────────────────────────────────────

export interface CycloneInfo {
  atcfId: string;
  wallet: string;
  name: string | null;         // null if unnamed (e.g. "Fourteen-E")
  stormType: string;
  latitude: number;
  longitude: number;
  pressureMb: number | null;
  windKt: number | null;
  headline: string | null;
}

export interface RssItem {
  title: string;
  description: string | null;
  pubDate: Date | null;
  link: string | null;
  guid: string | null;
  cyclone: CycloneInfo | null;
}

export interface ParsedFeed {
  channelTitle: string;
  channelPubDate: Date | null;
  items: RssItem[];
}

export interface ForecastPointDto {
  validAt: Date;
  latitude: number;
  longitude: number;
  windSpeedKt: number | null;
  pressureMb: number | null;
  category: number | null;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** "No current storm" (wallet) and "There are no tropical cyclones..." (summary) */
const SENTINEL_PATTERNS = [
  /No current storm/i,
  /no tropical cyclones at this time/i,
];

const MPH_TO_KT = 0.868976;

// ─────────────────────────────────────────────────────────────
// XML parser instance
// ─────────────────────────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  // Important: preserve the nhc: namespace prefix on tag names
  removeNSPrefix: false,
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
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
  if (/^(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty|Twenty-One|Twenty-Two|Twenty-Three)(-[A-Z])?$/i.test(name)) {
    return null;
  }
  return name;
}

function isSentinelTitle(title: string): boolean {
  return SENTINEL_PATTERNS.some((p) => p.test(title));
}

// ─────────────────────────────────────────────────────────────
// Parser 1: generic RSS feed → ParsedFeed
// ─────────────────────────────────────────────────────────────

export function parseRssFeed(xml: string): ParsedFeed {
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error('Not a valid RSS document: missing rss.channel');
  }

  const items = toArray<any>(channel.item).map((raw): RssItem => {
    const nhcCyclone = raw['nhc:Cyclone'];
    let cyclone: CycloneInfo | null = null;

    if (nhcCyclone) {
      const center = parseCenter(nhcCyclone['nhc:center']);
      const atcfId = String(nhcCyclone['nhc:atcf'] ?? '');
      const wallet = String(nhcCyclone['nhc:wallet'] ?? '');

      // Only build a CycloneInfo if we have the two critical IDs
      if (atcfId && wallet && center) {
        cyclone = {
          atcfId,
          wallet,
          name: normalizeName(nhcCyclone['nhc:name']),
          stormType: String(nhcCyclone['nhc:type'] ?? ''),
          latitude: center.lat,
          longitude: center.lon,
          pressureMb: parsePressureMb(nhcCyclone['nhc:pressure']),
          windKt: parseWindKt(nhcCyclone['nhc:wind']),
          headline: nhcCyclone['nhc:headline']
            ? String(nhcCyclone['nhc:headline'])
            : null,
        };
      }
    }

    return {
      title: String(raw.title ?? ''),
      description: raw.description ? String(raw.description) : null,
      pubDate: parseDate(raw.pubDate),
      link: raw.link ? String(raw.link) : null,
      guid:
        typeof raw.guid === 'object' && raw.guid !== null
          ? String(raw.guid['#text'] ?? '')
          : raw.guid
            ? String(raw.guid)
            : null,
      cyclone,
    };
  });

  return {
    channelTitle: String(channel.title ?? ''),
    channelPubDate: parseDate(channel.pubDate),
    items,
  };
}

// ─────────────────────────────────────────────────────────────
// Parser 2: extract storm summaries from a ParsedFeed
// ─────────────────────────────────────────────────────────────

export interface StormSummary {
  atcfId: string;
  basin: string;         // "EP", "AL", "CP" — derived from ATCF prefix
  name: string | null;
  stormType: string;
  wallet: string;
  issuedAt: Date;
  headline: string | null;
}

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

// ─────────────────────────────────────────────────────────────
// Parser 3: TCM forecast advisory → ForecastPointDto[]
// ─────────────────────────────────────────────────────────────

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
      category: null,   // we'll compute later from windSpeedKt
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────
// Category helper (Saffir-Simpson)
// ─────────────────────────────────────────────────────────────

export function categoryFromWindKt(kt: number | null): number | null {
  if (kt === null) return null;
  if (kt < 34) return null;   // not a tropical storm
  if (kt < 64) return 0;      // tropical storm
  if (kt <= 82) return 1;
  if (kt <= 95) return 2;
  if (kt <= 112) return 3;
  if (kt <= 136) return 4;
  return 5;
}