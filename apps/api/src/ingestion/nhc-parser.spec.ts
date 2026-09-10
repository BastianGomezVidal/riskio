import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  parseRssFeed,
  extractStormSummaries,
  parseForecastPoints,
  categoryFromWindKt,
} from './nhc-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', '..', 'test', 'fixtures');
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
