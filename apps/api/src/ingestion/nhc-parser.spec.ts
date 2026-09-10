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

    const points = parseForecastPoints(cdata);
    expect(points.length).toBeGreaterThanOrEqual(5);
    // First forecast point from the fixture: 10/1200Z 16.7N 118.5W, 35 KT
    const first = points[0];
    expect(first.latitude).toBeCloseTo(16.7, 1);
    expect(first.longitude).toBeCloseTo(-118.5, 1);
    expect(first.windSpeedKt).toBe(35);
  });
});

describe('categoryFromWindKt', () => {
  it('maps wind speeds to Saffir-Simpson categories', () => {
    expect(categoryFromWindKt(30)).toBeNull(); // below TS
    expect(categoryFromWindKt(40)).toBe(0);    // TS
    expect(categoryFromWindKt(70)).toBe(1);
    expect(categoryFromWindKt(90)).toBe(2);
    expect(categoryFromWindKt(110)).toBe(3);
    expect(categoryFromWindKt(130)).toBe(4);
    expect(categoryFromWindKt(150)).toBe(5);
  });
});