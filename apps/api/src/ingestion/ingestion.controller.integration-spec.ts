import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createTestApp } from '../../test/helpers/test-app.js';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import { StormsService } from '../storms/storms.service.js';
import { Advisory } from '../advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../forecast-points/entities/forecast-point.entity.js';

const FIXTURES_DIR = join(__dirname, '..', '..', 'test', 'fixtures');
const fixture = (name: string) =>
  readFileSync(join(FIXTURES_DIR, name), 'utf8');

describe('Ingestion endpoints (integration)', () => {
  let app: INestApplication;
  let stormsService: StormsService;

  const nhcMock = {
    fetchBasinSummary: (_basin: string) =>
      Promise.resolve(fixture('nhc-ep-active.xml')),
    fetchForecastAdvisory: (_wallet: string) =>
      Promise.resolve(fixture('tcm-ep4.xml')),
  };

  beforeAll(async () => {
    app = await createTestApp([{ provide: NhcProvider, useValue: nhcMock }]);
    stormsService = app.get(StormsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const pointsRepo = app.get(getRepositoryToken(ForecastPoint));
    const advRepo = app.get(getRepositoryToken(Advisory));
    await pointsRepo.createQueryBuilder().delete().execute();
    await advRepo.createQueryBuilder().delete().execute();

    await stormsService.upsertFromIngestion({
      atcfId: 'EP142026',
      name: null,
      basin: 'EP',
    });
  });

  it('GET /admin/ingest/run/ep ingests storm + advisory + points', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/ingest/run/ep')
      .expect(200);

    expect(res.body).toMatchObject({
      basin: 'ep',
      stormsSeen: 1,
      stormsUpserted: 1,
      advisoriesInserted: 1,
      advisoriesSkipped: 0,
    });
    expect(res.body.forecastPointsInserted).toBeGreaterThanOrEqual(5);
    expect(res.body.errors).toEqual([]);
  });

  it('is idempotent: re-running skips the same advisory', async () => {
    await request(app.getHttpServer()).get('/admin/ingest/run/ep').expect(200);

    const second = await request(app.getHttpServer())
      .get('/admin/ingest/run/ep')
      .expect(200);

    expect(second.body).toMatchObject({
      basin: 'ep',
      advisoriesInserted: 0,
      advisoriesSkipped: 1,
      errors: [],
    });
  });

  it('POST /admin/ingest/run ingests all basins', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/ingest/run')
      .expect(200);

    expect(res.body).toHaveLength(3);
    expect(res.body.map((r: { basin: string }) => r.basin)).toEqual([
      'at',
      'ep',
      'cp',
    ]);
    // The mock feed is basin-agnostic, so the shared storm/advisory is only
    // genuinely inserted once; the other basin passes skip it.
    const inserted = res.body.reduce(
      (sum: number, r: { advisoriesInserted: number }) =>
        sum + r.advisoriesInserted,
      0,
    );
    const skipped = res.body.reduce(
      (sum: number, r: { advisoriesSkipped: number }) =>
        sum + r.advisoriesSkipped,
      0,
    );
    expect(inserted).toBe(1);
    expect(skipped).toBe(2);
    expect(
      res.body.every((r: { errors: string[] }) => r.errors.length === 0),
    ).toBe(true);
  });

  it('rejects an unknown basin', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/ingest/run/xx')
      .expect(400);

    expect(res.body.message.length).toBeGreaterThan(0);
  });
});
