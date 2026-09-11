import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import { IngestionService } from './ingestion.service.js';
import { StormsService } from '../storms/storms.service.js';
import { AdvisoriesService } from '../advisories/advisories.service.js';
import { ForecastPointsService } from '../forecast-points/forecast-points.service.js';

const FIXTURES_DIR = join(__dirname, '..', '..', 'test', 'fixtures');
const fixture = (name: string) =>
  readFileSync(join(FIXTURES_DIR, name), 'utf8');
const fixtureBuffer = (name: string) =>
  readFileSync(join(FIXTURES_DIR, 'geometry', name));

function makeServices() {
  const fetchBasinSummary = vi.fn();
  const fetchForecastAdvisory = vi.fn();
  const fetchAdvisoryProduct = vi.fn();
  const upsertStorm = vi.fn();
  const upsertAdvisory = vi.fn();
  const replaceForAdvisory = vi.fn();
  const setTrackCone = vi.fn();
  const replaceWarnings = vi.fn();

  const nhc = {
    fetchBasinSummary,
    fetchForecastAdvisory,
    fetchAdvisoryProduct,
  } as unknown as NhcProvider;

  const storms = {
    upsertFromIngestion: upsertStorm,
  } as unknown as StormsService;

  const advisories = {
    upsertFromIngestion: upsertAdvisory,
    setTrackCone,
    replaceWarnings,
  } as unknown as AdvisoriesService;

  const forecastPoints = {
    replaceForAdvisory,
  } as unknown as ForecastPointsService;

  return {
    service: new IngestionService(nhc, storms, advisories, forecastPoints),
    fetchBasinSummary,
    fetchForecastAdvisory,
    fetchAdvisoryProduct,
    upsertStorm,
    upsertAdvisory,
    replaceForAdvisory,
    setTrackCone,
    replaceWarnings,
  };
}

describe('IngestionService', () => {
  let service: IngestionService;
  let fetchBasinSummary: ReturnType<typeof vi.fn>;
  let fetchForecastAdvisory: ReturnType<typeof vi.fn>;
  let fetchAdvisoryProduct: ReturnType<typeof vi.fn>;
  let upsertStorm: ReturnType<typeof vi.fn>;
  let upsertAdvisory: ReturnType<typeof vi.fn>;
  let replaceForAdvisory: ReturnType<typeof vi.fn>;
  let setTrackCone: ReturnType<typeof vi.fn>;
  let replaceWarnings: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const built = makeServices();
    service = built.service;
    fetchBasinSummary = built.fetchBasinSummary;
    fetchForecastAdvisory = built.fetchForecastAdvisory;
    fetchAdvisoryProduct = built.fetchAdvisoryProduct;
    upsertStorm = built.upsertStorm;
    upsertAdvisory = built.upsertAdvisory;
    replaceForAdvisory = built.replaceForAdvisory;
    setTrackCone = built.setTrackCone;
    replaceWarnings = built.replaceWarnings;
  });

  describe('ingestBasin', () => {
    it('ingests an active EP basin end-to-end from fixtures', async () => {
      const storm = { atcfId: 'EP142026', name: null, basin: 'EP' };
      const advisory = {
        id: 'adv-1',
        advisoryNumber: 2,
        issuedAt: new Date('2026-09-10T02:33:27Z'),
      };

      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      fetchAdvisoryProduct.mockResolvedValue(null);
      upsertStorm.mockResolvedValue(storm);
      upsertAdvisory.mockResolvedValue({
        advisory,
        inserted: true,
      });
      replaceForAdvisory.mockResolvedValue(8);
      setTrackCone.mockResolvedValue(undefined);
      replaceWarnings.mockResolvedValue(0);

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(1);
      expect(report.stormsUpserted).toBe(1);
      expect(report.advisoriesInserted).toBe(1);
      expect(report.advisoriesSkipped).toBe(0);
      expect(report.forecastPointsInserted).toBe(8);
      expect(report.geometriesUpdated).toBe(0);
      expect(report.warningSegments).toBe(0);
      expect(report.errors).toEqual([]);

      expect(upsertStorm).toHaveBeenCalledWith({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      expect(fetchForecastAdvisory).toHaveBeenCalledWith('EP4');
      expect(fetchAdvisoryProduct).toHaveBeenCalledWith('EP142026', 2, 'TRACK');
      expect(fetchAdvisoryProduct).toHaveBeenCalledWith('EP142026', 2, 'CONE');
      expect(fetchAdvisoryProduct).toHaveBeenCalledWith('EP142026', 2, 'WW');
      expect(setTrackCone).toHaveBeenCalledWith('adv-1', null, null);
      expect(replaceWarnings).toHaveBeenCalledWith(advisory, []);
    });

    it('reports skipped advisories when an existing one is found', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      upsertStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      upsertAdvisory.mockResolvedValue({
        advisory: { id: 'adv-1', advisoryNumber: 2 },
        inserted: false,
      });
      replaceForAdvisory.mockResolvedValue(8);

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(0);
      expect(report.advisoriesSkipped).toBe(1);
      expect(report.forecastPointsInserted).toBe(8);
    });

    it('handles a basin with no active storms', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-at-empty.xml'));

      const report = await service.ingestBasin('at');

      expect(report.stormsSeen).toBe(0);
      expect(report.stormsUpserted).toBe(0);
      expect(report.errors).toEqual([]);
      expect(fetchForecastAdvisory).not.toHaveBeenCalled();
    });

    it('records a fetch failure without throwing', async () => {
      fetchBasinSummary.mockRejectedValue(new Error('network down'));

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('network down');
    });

    it('continues to the next storm when the TCM fetch fails', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockRejectedValue(new Error('TCM 404'));
      upsertStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      const report = await service.ingestBasin('ep');

      expect(report.stormsUpserted).toBe(1);
      expect(report.advisoriesInserted).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('TCM fetch failed');
      expect(upsertAdvisory).not.toHaveBeenCalled();
    });

    it('stores track/cone geometry and warning segments from KMZ products', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      upsertStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      upsertAdvisory.mockResolvedValue({
        advisory: { id: 'adv-1', advisoryNumber: 2 },
        inserted: true,
      });
      replaceForAdvisory.mockResolvedValue(8);
      fetchAdvisoryProduct.mockImplementation(
        (_atcfId: string, _n: number, kind: string) => {
          if (kind === 'TRACK')
            return Promise.resolve(
              fixtureBuffer('ep142026_005adv_TRACK.kmz'),
            );
          if (kind === 'CONE')
            return Promise.resolve(fixtureBuffer('ep142026_005adv_CONE.kmz'));
          if (kind === 'WW')
            return Promise.resolve(fixtureBuffer('al112017_020adv_WW.kmz'));
          return Promise.resolve(null);
        },
      );
      setTrackCone.mockResolvedValue(undefined);
      // The WW fixture carries three Hurricane Watch segments.
      replaceWarnings.mockImplementation(
        (_advisory: unknown, segments: unknown[]) =>
          Promise.resolve(segments.length),
      );

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(1);
      expect(report.geometriesUpdated).toBe(1);
      expect(report.warningSegments).toBeGreaterThanOrEqual(1);
      expect(report.errors).toEqual([]);
      expect(setTrackCone).toHaveBeenCalledWith(
        'adv-1',
        expect.objectContaining({ type: 'LineString' }),
        expect.objectContaining({ type: 'Polygon' }),
      );
      expect(replaceWarnings).toHaveBeenCalledWith(
        { id: 'adv-1', advisoryNumber: 2 },
        expect.arrayContaining([
          expect.objectContaining({
            warningType: 'Hurricane Watch',
            geometry: expect.objectContaining({ type: 'LineString' }),
          }),
        ]),
      );
      const storedSegments = replaceWarnings.mock.calls[0][1] as Array<{
        warningType: string;
      }>;
      expect(storedSegments).toHaveLength(3);
      expect(
        storedSegments.every((s) => s.warningType === 'Hurricane Watch'),
      ).toBe(true);
    });

    it('records a geometry fetch failure but keeps the advisory', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      upsertStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      upsertAdvisory.mockResolvedValue({
        advisory: { id: 'adv-1', advisoryNumber: 2 },
        inserted: true,
      });
      replaceForAdvisory.mockResolvedValue(8);
      fetchAdvisoryProduct.mockImplementation(
        (_atcfId: string, _n: number, kind: string) => {
          if (kind === 'WW') return Promise.resolve(null);
          return Promise.reject(new Error('KMZ 500'));
        },
      );
      setTrackCone.mockResolvedValue(undefined);
      replaceWarnings.mockResolvedValue(0);

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(1);
      expect(report.geometriesUpdated).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('geometry fetch failed');
      expect(setTrackCone).not.toHaveBeenCalled();
    });

    it('records a warnings fetch failure but keeps the advisory', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      upsertStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      upsertAdvisory.mockResolvedValue({
        advisory: { id: 'adv-1', advisoryNumber: 2 },
        inserted: true,
      });
      replaceForAdvisory.mockResolvedValue(8);
      fetchAdvisoryProduct.mockImplementation(
        (_atcfId: string, _n: number, kind: string) => {
          if (kind === 'WW') return Promise.reject(new Error('WW 500'));
          return Promise.resolve(null);
        },
      );
      setTrackCone.mockResolvedValue(undefined);

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(1);
      expect(report.warningSegments).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('warnings fetch failed');
      expect(replaceWarnings).not.toHaveBeenCalled();
    });

    it('records per-storm errors without aborting the basin', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      upsertStorm.mockRejectedValue(new Error('db lock'));

      const report = await service.ingestBasin('ep');

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('db lock');
      expect(report.stormsUpserted).toBe(0);
    });

    it('skips a storm when the advisory number cannot be parsed', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(`<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title>POST-TROPICAL CYCLONE LOWELL FORECAST/ADVISORY</title>
            <pubDate>Thu, 10 Sep 2026 02:33:27 GMT</pubDate>
          </item>
        </channel></rss>`);
      upsertStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(0);
      expect(report.advisoriesSkipped).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('could not parse advisory number');
      expect(upsertAdvisory).not.toHaveBeenCalled();
    });

    it('falls back to the summary date and skips points when TCM fields are missing', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      fetchForecastAdvisory.mockResolvedValue(`<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title>$$ FORECAST/ADVISORY NUMBER 2 FOR TROPICAL STORM LOWELL</title>
          </item>
        </channel></rss>`);
      upsertStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      upsertAdvisory.mockResolvedValue({
        advisory: { id: 'adv-1', advisoryNumber: 2 },
        inserted: false,
      });

      const report = await service.ingestBasin('ep');

      expect(report.errors).toEqual([]);
      expect(report.advisoriesSkipped).toBe(1);
      expect(replaceForAdvisory).not.toHaveBeenCalled();
      expect(upsertAdvisory).toHaveBeenCalledWith({
        storm: expect.objectContaining({ atcfId: 'EP142026' }),
        advisoryNumber: 2,
        issuedAt: expect.any(Date),
        rawText: null,
      });
    });

    it('processes every basin in ingestAllBasins', async () => {
      const spy = vi.spyOn(service, 'ingestBasin').mockImplementation((b) =>
        Promise.resolve({
          basin: b,
          stormsSeen: 0,
          stormsUpserted: 0,
          advisoriesInserted: 0,
          advisoriesSkipped: 0,
          forecastPointsInserted: 0,
          geometriesUpdated: 0,
          warningSegments: 0,
          errors: [],
        }),
      );

      const reports = await service.ingestAllBasins();

      expect(reports.map((r) => r.basin)).toEqual(['at', 'ep', 'cp']);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy).toHaveBeenNthCalledWith(1, 'at');
      expect(spy).toHaveBeenNthCalledWith(2, 'ep');
      expect(spy).toHaveBeenNthCalledWith(3, 'cp');
      spy.mockRestore();
    });
  });
});
