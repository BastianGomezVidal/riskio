import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import { IngestionService } from './ingestion.service.js';
import { StormsService } from '../../weather/storms/storms.service.js';
import { AdvisoriesService } from '../../weather/advisories/advisories.service.js';
import { ForecastPointsService } from '../../weather/forecast-points/forecast-points.service.js';

const FIXTURES_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'test',
  'fixtures',
);

const fixture = (name: string) =>
  readFileSync(join(FIXTURES_DIR, name), 'utf8');

const fixtureBuffer = (name: string) =>
  readFileSync(join(FIXTURES_DIR, 'geometry', name));

function makeServices() {
  const fetchBasinSummary = vi.fn();
  const fetchForecastAdvisory = vi.fn();
  const fetchAdvisoryProduct = vi.fn();

  const reconcileFromFeed = vi.fn();
  const findStorm = vi.fn();
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
    reconcileFromFeed,
    findOne: findStorm,
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
    reconcileFromFeed,
    findStorm,
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
  let reconcileFromFeed: ReturnType<typeof vi.fn>;
  let findStorm: ReturnType<typeof vi.fn>;
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
    reconcileFromFeed = built.reconcileFromFeed;
    findStorm = built.findStorm;
    upsertAdvisory = built.upsertAdvisory;
    replaceForAdvisory = built.replaceForAdvisory;
    setTrackCone = built.setTrackCone;
    replaceWarnings = built.replaceWarnings;
  });

  describe('ingestBasin', () => {
    it('ingests an active basin end-to-end', async () => {
      const storm = {
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      };

      const advisory = {
        id: 'adv-1',
        advisoryNumber: 2,
        issuedAt: new Date('2026-09-10T02:33:27Z'),
      };

      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      fetchAdvisoryProduct.mockResolvedValue(null);

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue(storm);

      upsertAdvisory.mockResolvedValue({
        advisory,
        inserted: true,
      });

      replaceForAdvisory.mockResolvedValue(8);
      setTrackCone.mockResolvedValue(undefined);
      replaceWarnings.mockResolvedValue(0);

      const report = await service.ingestBasin('ep');

      expect(report).toMatchObject({
        basin: 'ep',
        stormsSeen: 1,
        stormsUpserted: 1,
        advisoriesInserted: 1,
        advisoriesSkipped: 0,
        forecastPointsInserted: 8,
        geometriesUpdated: 0,
        warningSegments: 0,
        errors: [],
      });

      expect(reconcileFromFeed).toHaveBeenCalledWith('ep', [
        {
          atcfId: 'EP142026',
          name: null,
          basin: 'EP',
        },
      ]);

      expect(findStorm).toHaveBeenCalledWith('EP142026');

      expect(fetchForecastAdvisory).toHaveBeenCalledWith('EP4');

      expect(fetchAdvisoryProduct).toHaveBeenCalledWith('EP142026', 2, 'TRACK');

      expect(fetchAdvisoryProduct).toHaveBeenCalledWith('EP142026', 2, 'CONE');

      expect(fetchAdvisoryProduct).toHaveBeenCalledWith('EP142026', 2, 'WW');

      expect(setTrackCone).toHaveBeenCalledWith('adv-1', null, null);

      expect(replaceWarnings).toHaveBeenCalledWith(advisory, []);
    });

    it('returns the advisory as skipped when it already exists', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        inserted: false,
      });

      replaceForAdvisory.mockResolvedValue(8);
      fetchAdvisoryProduct.mockResolvedValue(null);
      setTrackCone.mockResolvedValue(undefined);
      replaceWarnings.mockResolvedValue(0);

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(0);
      expect(report.advisoriesSkipped).toBe(1);
      expect(report.forecastPointsInserted).toBe(8);
      expect(report.errors).toEqual([]);
    });

    it('handles a basin with no active storms', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-at-empty.xml'));

      const report = await service.ingestBasin('at');

      expect(report).toMatchObject({
        basin: 'at',
        stormsSeen: 0,
        stormsUpserted: 0,
        advisoriesInserted: 0,
        advisoriesSkipped: 0,
        forecastPointsInserted: 0,
        geometriesUpdated: 0,
        warningSegments: 0,
        errors: [],
      });

      // An empty but cleanly parsed feed authorizes flipping the basin
      // inactive before the early return.
      expect(reconcileFromFeed).toHaveBeenCalledWith('at', []);

      expect(findStorm).not.toHaveBeenCalled();
      expect(fetchForecastAdvisory).not.toHaveBeenCalled();
    });

    it('refuses to flip activity flags when a feed has items but no storms are extracted', async () => {
      fetchBasinSummary.mockResolvedValue(`
        <?xml version="1.0"?>
        <rss version="2.0" xmlns:nhc="https://www.nhc.noaa.gov">
          <channel>
            <item>
              <title>Summary for Tropical Storm Mystery (EP9/EP902026)</title>
              <pubDate>Thu, 10 Sep 2026 02:33:27 GMT</pubDate>
              <nhc:Cyclone>
                <nhc:name>Mystery</nhc:name>
                <nhc:type>Tropical Storm</nhc:type>
                <nhc:center>12.3, -130.1</nhc:center>
                <nhc:wind>45 mph</nhc:wind>
              </nhc:Cyclone>
            </item>
          </channel>
        </rss>
      `);

      const report = await service.ingestBasin('ep');

      // One item carries an nhc:Cyclone element but is missing the ATCF id
      // and wallet, so no storm was extracted. That is format drift, not a
      // genuinely quiet basin, so state must stay untouched.
      expect(report.stormsSeen).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('refusing to flip activity flags');
      expect(report.errors[0]).toContain('1 cyclone item');

      expect(reconcileFromFeed).not.toHaveBeenCalled();
      expect(findStorm).not.toHaveBeenCalled();
      expect(fetchForecastAdvisory).not.toHaveBeenCalled();
    });

    it('records a basin fetch failure without throwing', async () => {
      fetchBasinSummary.mockRejectedValue(new Error('network down'));

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('network down');

      expect(reconcileFromFeed).not.toHaveBeenCalled();
    });

    it('records a basin parsing failure without throwing', async () => {
      fetchBasinSummary.mockResolvedValue('<invalid xml>');

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('fetch/parse failed');

      expect(reconcileFromFeed).not.toHaveBeenCalled();
    });

    it('continues to the next storm when the TCM fetch fails', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockRejectedValue(new Error('TCM 404'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      const report = await service.ingestBasin('ep');

      expect(report.stormsUpserted).toBe(1);
      expect(report.advisoriesInserted).toBe(0);
      expect(report.advisoriesSkipped).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('TCM fetch failed');

      expect(upsertAdvisory).not.toHaveBeenCalled();
    });

    it('records a TCM parsing failure without aborting the storm', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue('<invalid xml>');

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      const report = await service.ingestBasin('ep');

      expect(report.stormsUpserted).toBe(1);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('storm processing failed');

      expect(upsertAdvisory).not.toHaveBeenCalled();
    });

    it('skips a storm when the advisory number cannot be parsed', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(`
        <?xml version="1.0"?>
        <rss>
          <channel>
            <item>
              <title>
                POST-TROPICAL CYCLONE LOWELL FORECAST/ADVISORY
              </title>
              <pubDate>
                Thu, 10 Sep 2026 02:33:27 GMT
              </pubDate>
            </item>
          </channel>
        </rss>
      `);

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      const report = await service.ingestBasin('ep');

      expect(report.stormsUpserted).toBe(1);
      expect(report.advisoriesInserted).toBe(0);
      expect(report.advisoriesSkipped).toBe(0);
      expect(report.errors).toHaveLength(1);

      expect(report.errors[0]).toContain('could not parse advisory number');

      expect(upsertAdvisory).not.toHaveBeenCalled();
    });

    it('uses the summary date when the TCM publication date is missing', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(`
        <?xml version="1.0"?>
        <rss>
          <channel>
            <item>
              <title>
                $$ FORECAST/ADVISORY NUMBER 2 FOR TROPICAL STORM LOWELL
              </title>
            </item>
          </channel>
        </rss>
      `);

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        inserted: false,
      });

      const report = await service.ingestBasin('ep');

      expect(report.errors).toEqual([]);
      expect(report.advisoriesSkipped).toBe(1);
      expect(report.forecastPointsInserted).toBe(0);

      expect(replaceForAdvisory).not.toHaveBeenCalled();

      expect(upsertAdvisory).toHaveBeenCalledWith({
        storm: expect.objectContaining({
          atcfId: 'EP142026',
        }),
        advisoryNumber: 2,
        issuedAt: expect.any(Date),
        rawText: null,
      });
    });

    it('records an advisory persistence failure without aborting the basin', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockRejectedValue(new Error('database unavailable'));

      const report = await service.ingestBasin('ep');

      expect(report.stormsUpserted).toBe(1);
      expect(report.advisoriesInserted).toBe(0);
      expect(report.advisoriesSkipped).toBe(0);
      expect(report.errors).toHaveLength(1);

      expect(report.errors[0]).toContain('database unavailable');

      expect(replaceForAdvisory).not.toHaveBeenCalled();
      expect(fetchAdvisoryProduct).not.toHaveBeenCalled();
    });

    it('records a forecast-point persistence failure and does not process geometry or warnings', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        inserted: true,
      });

      replaceForAdvisory.mockRejectedValue(
        new Error('forecast point insert failed'),
      );

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(1);
      expect(report.forecastPointsInserted).toBe(0);
      expect(report.geometriesUpdated).toBe(0);
      expect(report.warningSegments).toBe(0);

      expect(report.errors).toHaveLength(1);

      expect(report.errors[0]).toContain('forecast point insert failed');

      expect(fetchAdvisoryProduct).not.toHaveBeenCalled();
      expect(setTrackCone).not.toHaveBeenCalled();
      expect(replaceWarnings).not.toHaveBeenCalled();
    });

    it('does not process geometry when there are no forecast points to replace', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        inserted: true,
      });

      replaceForAdvisory.mockResolvedValue(0);

      const report = await service.ingestBasin('ep');

      expect(report.errors).toEqual([]);
      expect(report.forecastPointsInserted).toBe(0);

      expect(fetchAdvisoryProduct).not.toHaveBeenCalled();
      expect(setTrackCone).not.toHaveBeenCalled();
      expect(replaceWarnings).not.toHaveBeenCalled();
    });

    it('stores track and cone geometry and warning segments', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        inserted: true,
      });

      replaceForAdvisory.mockResolvedValue(8);

      fetchAdvisoryProduct.mockImplementation(
        (_atcfId: string, _number: number, kind: string) => {
          if (kind === 'TRACK') {
            return Promise.resolve(fixtureBuffer('ep142026_005adv_TRACK.kmz'));
          }

          if (kind === 'CONE') {
            return Promise.resolve(fixtureBuffer('ep142026_005adv_CONE.kmz'));
          }

          if (kind === 'WW') {
            return Promise.resolve(fixtureBuffer('al112017_020adv_WW.kmz'));
          }

          return Promise.resolve(null);
        },
      );

      setTrackCone.mockResolvedValue(undefined);

      replaceWarnings.mockImplementation(
        (_advisory: unknown, segments: unknown[]) =>
          Promise.resolve(segments.length),
      );

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(1);
      expect(report.forecastPointsInserted).toBe(8);
      expect(report.geometriesUpdated).toBe(1);
      expect(report.warningSegments).toBeGreaterThanOrEqual(1);
      expect(report.errors).toEqual([]);

      expect(setTrackCone).toHaveBeenCalledWith(
        'adv-1',
        expect.objectContaining({
          type: 'LineString',
        }),
        expect.objectContaining({
          type: 'Polygon',
        }),
      );

      expect(replaceWarnings).toHaveBeenCalledWith(
        {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        expect.arrayContaining([
          expect.objectContaining({
            warningType: 'Hurricane Watch',
            geometry: expect.objectContaining({
              type: 'LineString',
            }),
          }),
        ]),
      );

      const storedSegments = replaceWarnings.mock.calls[0][1] as Array<{
        warningType: string;
      }>;

      expect(storedSegments).toHaveLength(3);

      expect(
        storedSegments.every(
          (segment) => segment.warningType === 'Hurricane Watch',
        ),
      ).toBe(true);
    });

    it('continues when geometry processing fails', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        inserted: true,
      });

      replaceForAdvisory.mockResolvedValue(8);

      fetchAdvisoryProduct.mockImplementation(
        (_atcfId: string, _number: number, kind: string) => {
          if (kind === 'WW') {
            return Promise.resolve(null);
          }

          return Promise.reject(new Error('KMZ 500'));
        },
      );

      setTrackCone.mockResolvedValue(undefined);
      replaceWarnings.mockResolvedValue(0);

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(1);
      expect(report.forecastPointsInserted).toBe(8);
      expect(report.geometriesUpdated).toBe(0);

      expect(report.errors).toHaveLength(1);

      expect(report.errors[0]).toContain('geometry fetch failed');

      expect(setTrackCone).not.toHaveBeenCalled();

      expect(replaceWarnings).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'adv-1',
        }),
        [],
      );
    });

    it('continues when warning retrieval fails', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockResolvedValue(undefined);
      findStorm.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-1',
          advisoryNumber: 2,
        },
        inserted: true,
      });

      replaceForAdvisory.mockResolvedValue(8);

      fetchAdvisoryProduct.mockImplementation(
        (_atcfId: string, _number: number, kind: string) => {
          if (kind === 'WW') {
            return Promise.reject(new Error('WW 500'));
          }

          return Promise.resolve(null);
        },
      );

      setTrackCone.mockResolvedValue(undefined);

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(1);
      expect(report.forecastPointsInserted).toBe(8);
      expect(report.warningSegments).toBe(0);

      expect(report.errors).toHaveLength(1);

      expect(report.errors[0]).toContain('warnings fetch failed');

      expect(replaceWarnings).not.toHaveBeenCalled();
    });

    it('returns early without throwing when activity reconciliation fails', async () => {
      fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));

      fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));

      reconcileFromFeed.mockRejectedValue(new Error('db lock'));

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(1);
      expect(report.stormsUpserted).toBe(0);

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('activity reconciliation failed');
      expect(report.errors[0]).toContain('db lock');

      // The basin is left in its prior state, so no per-storm work runs.
      expect(findStorm).not.toHaveBeenCalled();
      expect(fetchForecastAdvisory).not.toHaveBeenCalled();
    });

    it('continues processing subsequent storms when one storm fails', async () => {
      fetchBasinSummary.mockResolvedValue(
        fixture('nhc-ep-active-two-storms.xml'),
      );

      reconcileFromFeed.mockResolvedValue(undefined);

      let stormCall = 0;

      findStorm.mockImplementation(async (atcfId: string) => {
        stormCall++;

        if (stormCall === 1) {
          throw new Error('first storm failed');
        }

        return {
          atcfId,
          name: 'Test',
          basin: 'EP',
        };
      });

      /*
       * Both storms are reconciled in a single batch. The first storm
       * then fails inside the per-storm loop when findOne() loads it.
       *
       * The second fixture storm uses EP5, so the service should
       * request EP5 here.
       */
      fetchForecastAdvisory.mockImplementation(async (wallet: string) => {
        expect(wallet).toBe('EP5');

        return fixture('tcm-ep4.xml');
      });

      upsertAdvisory.mockResolvedValue({
        advisory: {
          id: 'adv-2',
          advisoryNumber: 2,
        },
        inserted: true,
      });

      replaceForAdvisory.mockResolvedValue(8);

      fetchAdvisoryProduct.mockResolvedValue(null);
      setTrackCone.mockResolvedValue(undefined);
      replaceWarnings.mockResolvedValue(0);

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(2);

      // First storm failed, second storm succeeded.
      expect(report.stormsUpserted).toBe(1);

      // Only the successful second storm should create an advisory.
      expect(report.advisoriesInserted).toBe(1);
      expect(report.advisoriesSkipped).toBe(0);

      expect(report.forecastPointsInserted).toBe(8);
      expect(report.geometriesUpdated).toBe(0);
      expect(report.warningSegments).toBe(0);

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('first storm failed');

      // Reconciliation is a single batch call for the whole basin.
      expect(reconcileFromFeed).toHaveBeenCalledTimes(1);
      expect(reconcileFromFeed).toHaveBeenCalledWith('ep', [
        { atcfId: 'EP142026', name: 'Lowell', basin: 'EP' },
        { atcfId: 'EP152026', name: 'Test', basin: 'EP' },
      ]);

      expect(findStorm).toHaveBeenCalledTimes(2);

      /*
       * The failed first storm must not continue into TCM
       * processing.
       */
      expect(fetchForecastAdvisory).toHaveBeenCalledTimes(1);

      expect(fetchForecastAdvisory).toHaveBeenCalledWith('EP5');

      expect(upsertAdvisory).toHaveBeenCalledTimes(1);

      expect(replaceForAdvisory).toHaveBeenCalledTimes(1);
    });
  });

  describe('ingestAllBasins', () => {
    it('processes every configured basin in order', async () => {
      const spy = vi.spyOn(service, 'ingestBasin').mockImplementation((basin) =>
        Promise.resolve({
          basin,
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

      expect(reports.map((report) => report.basin)).toEqual(['at', 'ep', 'cp']);

      expect(spy).toHaveBeenCalledTimes(3);

      expect(spy).toHaveBeenNthCalledWith(1, 'at');

      expect(spy).toHaveBeenNthCalledWith(2, 'ep');

      expect(spy).toHaveBeenNthCalledWith(3, 'cp');

      spy.mockRestore();
    });

    it('continues processing when a basin returns an error report', async () => {
      const spy = vi
        .spyOn(service, 'ingestBasin')
        .mockImplementation((basin) => {
          if (basin === 'ep') {
            return Promise.resolve({
              basin,
              stormsSeen: 0,
              stormsUpserted: 0,
              advisoriesInserted: 0,
              advisoriesSkipped: 0,
              forecastPointsInserted: 0,
              geometriesUpdated: 0,
              warningSegments: 0,
              errors: ['basin failed'],
            });
          }

          return Promise.resolve({
            basin,
            stormsSeen: 1,
            stormsUpserted: 1,
            advisoriesInserted: 1,
            advisoriesSkipped: 0,
            forecastPointsInserted: 8,
            geometriesUpdated: 1,
            warningSegments: 0,
            errors: [],
          });
        });

      const reports = await service.ingestAllBasins();

      expect(reports).toHaveLength(3);

      expect(reports[0]).toMatchObject({
        basin: 'at',
      });

      expect(reports[1]).toMatchObject({
        basin: 'ep',
        errors: ['basin failed'],
      });

      expect(reports[2]).toMatchObject({
        basin: 'cp',
      });

      expect(spy).toHaveBeenCalledTimes(3);

      spy.mockRestore();
    });
  });
});
