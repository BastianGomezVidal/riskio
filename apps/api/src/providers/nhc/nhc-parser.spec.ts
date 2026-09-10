import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseRssFeed,
  extractStormSummaries,
  parseForecastPoints,
} from './nhc-parser.js';
import { categoryFromWindKt } from '../../storms/storm-category.js';

const FIXTURES_DIR = join(__dirname, '..', '..', '..', 'test', 'fixtures');
const fixture = (name: string) =>
  readFileSync(join(FIXTURES_DIR, name), 'utf8');

describe('parseRssFeed', () => {
  it('parses the empty Atlantic feed (sentinel)', () => {
    const feed = parseRssFeed(fixture('nhc-at-empty.xml'));
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items[0].cyclone).toBeNull();
  });

  it('parses the active East Pacific feed with nhc:Cyclone', () => {
    const feed = parseRssFeed(fixture('nhc-ep-active.xml'));
    const summaries = extractStormSummaries(feed);
    expect(summaries.length).toBeGreaterThan(0);
    expect(summaries[0].atcfId).toBe('EP142026');
    expect(summaries[0].basin).toBe('EP');
    expect(summaries[0].wallet).toBe('EP4');
    expect(summaries[0].name).toBeNull(); // "Fourteen-E" is a designation
    expect(summaries[0].stormType).toBe('Tropical Depression');
  });

  it('parses the active Central Pacific feed (real named storm)', () => {
    const feed = parseRssFeed(fixture('nhc-cp-active.xml'));
    const summaries = extractStormSummaries(feed);
    expect(summaries.length).toBeGreaterThan(0);
    const lowell = summaries.find((s) => s.wallet === 'CP4');
    expect(lowell?.name).toBe('Lowell');
    expect(lowell?.atcfId).toBe('EP122026');
    expect(lowell?.stormType).toBe('Tropical Storm');
  });

  it('throws on a document that is not RSS', () => {
    expect(() => parseRssFeed('<html><body>hi</body></html>')).toThrow(
      /not a valid RSS/i,
    );
  });

  it('skips items without pubDate when extracting summaries', () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>Summary for Tropical Storm X (AL1/AL012026)</title>
          <nhc:Cyclone xmlns="x"><nhc:center>10.0, -50.0</nhc:center>
            <nhc:type>Tropical Storm</nhc:type><nhc:name>X</nhc:name>
            <nhc:wallet>AL1</nhc:wallet><nhc:atcf>AL012026</nhc:atcf></nhc:Cyclone>
        </item>
      </channel></rss>`;
    const feed = parseRssFeed(xml);
    expect(extractStormSummaries(feed)).toHaveLength(0);
  });

  it('does not build CycloneInfo when atcf or wallet is missing', () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>Summary for Tropical Depression Fourteen-E</title>
          <pubDate>Thu, 10 Sep 2026 02:33:27 GMT</pubDate>
          <nhc:Cyclone><nhc:center>16.4, -116.6</nhc:center>
            <nhc:type>Tropical Depression</nhc:type><nhc:name>Fourteen-E</nhc:name>
            <nhc:wallet>EP4</nhc:wallet></nhc:Cyclone>
        </item>
      </channel></rss>`;
    const feed = parseRssFeed(xml);
    // no nhc:atcf → cyclone must be null
    expect(feed.items[0].cyclone).toBeNull();
  });

  describe('name normalization', () => {
    function summaryName(title: string, name: string): string | null {
      const xml = `<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title>${title}</title>
            <pubDate>Thu, 10 Sep 2026 02:33:27 GMT</pubDate>
            <nhc:Cyclone><nhc:center>16.4, -116.6</nhc:center>
              <nhc:type>Depression</nhc:type><nhc:name>${name}</nhc:name>
              <nhc:wallet>EP4</nhc:wallet><nhc:atcf>EP142026</nhc:atcf></nhc:Cyclone>
          </item>
        </channel></rss>`;
      const feed = parseRssFeed(xml);
      const summaries = extractStormSummaries(feed);
      if (summaries.length === 0) return null;
      return summaries[0].name;
    }

    it('returns null for numbered designation "Fourteen-E"', () => {
      expect(summaryName('x', 'Fourteen-E')).toBeNull();
    });
    it('returns null for "One", "Twenty-Two" etc.', () => {
      expect(summaryName('x', 'One')).toBeNull();
      expect(summaryName('x', 'Twenty-Two')).toBeNull();
      expect(summaryName('x', 'Three-C')).toBeNull();
    });
    it('keeps real storm names', () => {
      expect(summaryName('x', 'Lowell')).toBe('Lowell');
      expect(summaryName('x', 'Milton')).toBe('Milton');
      expect(summaryName('x', 'Sara')).toBe('Sara');
    });
  });
});

describe('parseForecastPoints', () => {
  it('extracts forecast points from the TCM advisory CDATA', () => {
    const feed = parseRssFeed(fixture('tcm-ep4.xml'));
    const cdata = feed.items[0].description ?? '';
    expect(cdata).toContain('FORECAST VALID');

    const pubDate = feed.items[0].pubDate!;
    expect(pubDate).toBeInstanceOf(Date);

    const points = parseForecastPoints(cdata, pubDate);
    expect(points.length).toBeGreaterThanOrEqual(5);
    // First forecast point from the fixture: 10/1200Z 16.7N 118.5W, 35 KT
    const first = points[0];
    expect(first.latitude).toBeCloseTo(16.7, 1);
    expect(first.longitude).toBeCloseTo(-118.5, 1);
    expect(first.windSpeedKt).toBe(35);
  });

  it('includes OUTLOOK VALID points in the same sequence', () => {
    const feed = parseRssFeed(fixture('tcm-ep4.xml'));
    const cdata = feed.items[0].description ?? '';
    const points = parseForecastPoints(cdata, feed.items[0].pubDate!);
    // tcm-ep4 has 6 FORECAST + 2 OUTLOOK points
    expect(points).toHaveLength(8);
  });

  it('handles southern and western hemispheres', () => {
    const refDate = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const cdata = 'FORECAST VALID 16/1200Z 18.5S 140.2E\nMAX WIND  45 KT';
    const points = parseForecastPoints(cdata, refDate);
    expect(points).toHaveLength(1);
    expect(points[0].latitude).toBeCloseTo(-18.5, 1);
    expect(points[0].longitude).toBeCloseTo(140.2, 1);
  });

  it('rolls over to the next month when forecast day < reference day', () => {
    // Advisory issued Sep 30, forecast valid day 01 → should be Oct 01
    const refDate = new Date(Date.UTC(2026, 8, 30, 12, 0, 0)); // Sep 30 2026
    const cdata = 'FORECAST VALID 01/0000Z 15.0N 120.0W<br />MAX WIND  40 KT';
    const points = parseForecastPoints(cdata, refDate);
    expect(points).toHaveLength(1);
    const p = points[0];
    expect(p.validAt.getUTCFullYear()).toBe(2026);
    expect(p.validAt.getUTCMonth()).toBe(9); // October (0-based)
    expect(p.validAt.getUTCDate()).toBe(1);
    expect(p.validAt.getUTCHours()).toBe(0);
  });

  it('rolls over to the next year when crossing December 31', () => {
    const refDate = new Date(Date.UTC(2026, 11, 31, 12, 0, 0)); // Dec 31 2026
    const cdata = 'FORECAST VALID 01/0000Z 15.0N 120.0W<br />MAX WIND  40 KT';
    const points = parseForecastPoints(cdata, refDate);
    expect(points[0].validAt.getUTCFullYear()).toBe(2027);
    expect(points[0].validAt.getUTCMonth()).toBe(0); // January
    expect(points[0].validAt.getUTCDate()).toBe(1);
  });

  it('does not read ahead beyond 3 lines for MAX WIND', () => {
    const refDate = new Date(Date.UTC(2026, 0, 10, 3, 0, 0));
    // Three radius lines follow the VALID line; MAX WIND is on line 4 →
    // outside the 3-line lookahead window and must not be picked up.
    const cdata = [
      'FORECAST VALID 10/1200Z 16.7N 118.5W',
      '34 KT... 30NE  20SE   0SW  20NW.',
      '64 KT... 15NE   0SE   0SW  10NW.',
      '50 KT... 30NE  10SE  10SW  20NW.',
      'MAX WIND  55 KT...GUSTS  65 KT.',
    ].join('\n');
    const points = parseForecastPoints(cdata, refDate);
    expect(points).toHaveLength(1);
    expect(points[0].windSpeedKt).toBeNull();
  });

  it('returns an empty list for text without forecast points', () => {
    const points = parseForecastPoints('NO FORECAST HERE', new Date());
    expect(points).toEqual([]);
  });
});

describe('categoryFromWindKt', () => {
  it('maps wind speeds to Saffir-Simpson categories', () => {
    expect(categoryFromWindKt(30)).toBeNull(); // below TS
    expect(categoryFromWindKt(40)).toBe(0); // TS
    expect(categoryFromWindKt(70)).toBe(1);
    expect(categoryFromWindKt(90)).toBe(2);
    expect(categoryFromWindKt(110)).toBe(3);
    expect(categoryFromWindKt(130)).toBe(4);
    expect(categoryFromWindKt(150)).toBe(5);
  });
});