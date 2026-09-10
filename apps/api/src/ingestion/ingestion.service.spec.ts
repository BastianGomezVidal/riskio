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

function makeServices() {
  const nhc = {
    fetchBasinSummary: vi.fn(),
    fetchForecastAdvisory: vi.fn(),
  } as unknown as NhcProvider;

  const storms = {
    upsertFromIngestion: vi.fn(),
  } as unknown as StormsService;

  const advisories = {
    upsertFromIngestion: vi.fn(),
  } as unknown as AdvisoriesService;

  const forecastPoints = {
    replaceForAdvisory: vi.fn(),
  } as unknown as ForecastPointsService;

  return new IngestionService(nhc, storms, advisories, forecastPoints);
}

describe('IngestionService', () => {
  let service: IngestionService;
  let nhc: NhcProvider;
  let storms: StormsService;
  let advisories: AdvisoriesService;
  let forecastPoints: ForecastPointsService;

  beforeEach(() => {
    service = makeServices();
    nhc = (service as unknown as { nhc: NhcProvider }).nhc;
    storms = (service as unknown as { storms: StormsService }).storms;
    advisories = (service as unknown as { advisories: AdvisoriesService }).advisories;
    forecastPoints = (service as unknown as { forecastPoints: ForecastPointsService })
      .forecastPoints;
  });

  describe('ingestBasin', () => {
    it('ingests an active EP basin end-to-end from fixtures', async () => {
      const storm = { atcfId: 'EP142026', name: null, basin: 'EP' };
      const advisory = {
        id: 'adv-1',
        advisoryNumber: 2,
        issuedAt: new Date('2026-09-10T02:33:27Z'),
      };

      nhc.fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      nhc.fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      storms.upsertFromIngestion.mockResolvedValue(storm);
      advisories.upsertFromIngestion.mockResolvedValue({
        advisory,
        inserted: true,
      });
      forecastPoints.replaceForAdvisory.mockResolvedValue(8);

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(1);
      expect(report.stormsUpserted).toBe(1);
      expect(report.advisoriesInserted).toBe(1);
      expect(report.advisoriesSkipped).toBe(0);
      expect(report.forecastPointsInserted).toBe(8);
      expect(report.errors).toEqual([]);

      expect(storms.upsertFromIngestion).toHaveBeenCalledWith({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      expect(nhc.fetchForecastAdvisory).toHaveBeenCalledWith('EP4');
    });

    it('reports skipped advisories when an existing one is found', async () => {
      nhc.fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      nhc.fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      storms.upsertFromIngestion.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });
      advisories.upsertFromIngestion.mockResolvedValue({
        advisory: { id: 'adv-1', advisoryNumber: 2 },
        inserted: false,
      });
      forecastPoints.replaceForAdvisory.mockResolvedValue(8);

      const report = await service.ingestBasin('ep');

      expect(report.advisoriesInserted).toBe(0);
      expect(report.advisoriesSkipped).toBe(1);
      expect(report.forecastPointsInserted).toBe(8);
    });

    it('handles a basin with no active storms', async () => {
      nhc.fetchBasinSummary.mockResolvedValue(fixture('nhc-at-empty.xml'));

      const report = await service.ingestBasin('at');

      expect(report.stormsSeen).toBe(0);
      expect(report.stormsUpserted).toBe(0);
      expect(report.errors).toEqual([]);
      expect(nhc.fetchForecastAdvisory).not.toHaveBeenCalled();
    });

    it('records a fetch failure without throwing', async () => {
      nhc.fetchBasinSummary.mockRejectedValue(new Error('network down'));

      const report = await service.ingestBasin('ep');

      expect(report.stormsSeen).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('network down');
    });

    it('continues to the next storm when the TCM fetch fails', async () => {
      nhc.fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      nhc.fetchForecastAdvisory.mockRejectedValue(new Error('TCM 404'));
      storms.upsertFromIngestion.mockResolvedValue({
        atcfId: 'EP142026',
        name: null,
        basin: 'EP',
      });

      const report = await service.ingestBasin('ep');

      expect(report.stormsUpserted).toBe(1);
      expect(report.advisoriesInserted).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('TCM fetch failed');
      expect(advisories.upsertFromIngestion).not.toHaveBeenCalled();
    });

    it('records per-storm errors without aborting the basin', async () => {
      nhc.fetchBasinSummary.mockResolvedValue(fixture('nhc-ep-active.xml'));
      nhc.fetchForecastAdvisory.mockResolvedValue(fixture('tcm-ep4.xml'));
      storms.upsertFromIngestion.mockRejectedValue(new Error('db lock'));

      const report = await service.ingestBasin('ep');

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('db lock');
      expect(report.stormsUpserted).toBe(0);
    });
  });
});