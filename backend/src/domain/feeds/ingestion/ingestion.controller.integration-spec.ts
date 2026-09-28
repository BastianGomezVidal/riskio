import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createTestApp,
  registerAndLogin,
  bearer,
  listAdvisoryIds,
} from '../../../../test/helpers/test-app.js';
import { NhcProvider } from '../providers/nhc/nhc.provider.js';
import { StormWriter } from './writers/storm-writer.js';
import { Advisory } from '../../weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../weather/advisories/entities/forecast-point.entity.js';
import { AuthService } from '../../auth/auth.service.js';
import { User } from '../../auth/entities/user.entity.js';

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

/**
 * Creates an admin account and returns a plaintext API token. The ingestion
 * endpoints are guarded by `ApiKeyGuard` + `RolesGuard` requiring the `admin`
 * role, so integration tests must present a valid `x-api-key`.
 */
async function createAdminApiKey(targetApp: INestApplication): Promise<string> {
  const users = targetApp.get<Repository<User>>(getRepositoryToken(User));
  const auth = targetApp.get(AuthService);

  const admin = await users.save(
    users.create({
      email: 'admin@ingestion.test',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Tester',
      phone: null,
      passwordHash: null,
    }),
  );

  const { token } = await auth.createApiToken(admin.id, 'integration-test');
  return token;
}

describe('Ingestion endpoints (integration)', () => {
  let app: INestApplication;
  let token: string;
  let stormWriter: StormWriter;
  let adminKey: string;

  const nhcMock = {
    fetchBasinSummary: (_basin: string) =>
      Promise.resolve(fixture('nhc-ep-active.xml')),
    fetchForecastAdvisory: (_wallet: string) =>
      Promise.resolve(fixture('tcm-ep4.xml')),
    fetchAdvisoryProduct: () => Promise.resolve(null),
  };

  beforeAll(async () => {
    app = await createTestApp([{ provide: NhcProvider, useValue: nhcMock }]);
    stormWriter = app.get(StormWriter);
    adminKey = await createAdminApiKey(app);

    token = await registerAndLogin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const pointsRepo = app.get(getRepositoryToken(ForecastPoint));
    const advRepo = app.get(getRepositoryToken(Advisory));
    await pointsRepo.createQueryBuilder().delete().execute();
    await advRepo.createQueryBuilder().delete().execute();

    await stormWriter.upsert({
      atcfId: 'EP142026',
      name: null,
      basin: 'EP',
    });
  });

  it('rejects a request without an API key', async () => {
    await request(app.getHttpServer())
      .post('/admin/ingest/run/ep')
      .set(...(bearer(token) as [string, string]))
      .expect(401);
  });

  it('POST /admin/ingest/run/ep ingests storm + advisory + points', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/ingest/run/ep')
      .set(...bearer(token) as [string, string])
      .set('x-api-key', adminKey)
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
    await request(app.getHttpServer())
      .post('/admin/ingest/run/ep')
      .set(...bearer(token) as [string, string])
      .set('x-api-key', adminKey)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/admin/ingest/run/ep')
      .set(...bearer(token) as [string, string])
      .set('x-api-key', adminKey)
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
      .set(...bearer(token) as [string, string])
      .set('x-api-key', adminKey)
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

  it('stores track/cone geometry and warning segments from KMZ products', async () => {
    const geometryDir = join(FIXTURES_DIR, 'geometry');
    const readKmz = (name: string) => readFileSync(join(geometryDir, name));
    const productFor = (kind: string): Buffer | null => {
      if (kind === 'TRACK') return readKmz('ep142026_005adv_TRACK.kmz');
      if (kind === 'CONE') return readKmz('ep142026_005adv_CONE.kmz');
      if (kind === 'WW') return readKmz('al112017_020adv_WW.kmz');
      return null;
    };
    const kmzApp = await createTestApp([
      {
        provide: NhcProvider,
        useValue: {
          fetchBasinSummary: () =>
            Promise.resolve(fixture('nhc-ep-active.xml')),
          fetchForecastAdvisory: () => Promise.resolve(fixture('tcm-ep4.xml')),
          fetchAdvisoryProduct: (_atcfId: string, _n: number, kind: string) =>
            Promise.resolve(productFor(kind)),
        },
      },
    ]);
    try {
      const res = await request(kmzApp.getHttpServer())
        .post('/admin/ingest/run/ep')
        .set(...(bearer(token) as [string, string]))
        .set('x-api-key', adminKey)
        .expect(200);

      expect(res.body.geometriesUpdated).toBe(1);
      expect(res.body.warningSegments).toBeGreaterThanOrEqual(1);
      expect(res.body.errors).toEqual([]);

      const ids = await listAdvisoryIds(kmzApp, 'EP142026', token);
      const adv = await request(kmzApp.getHttpServer())
        .get(`/advisories/${ids[0]}`)
        .set(...(bearer(token) as [string, string]))
        .expect(200);
      expect(adv.body.track).toMatchObject({ type: 'LineString' });
      expect(adv.body.cone).toMatchObject({ type: 'Polygon' });

      // There is no /advisories/:id/warnings route. The segments ride inside
      // the advisory detail, which is where the web client looks for them.
      expect(adv.body.warnings.length).toBeGreaterThanOrEqual(1);
      expect(adv.body.warnings[0].warningType).toBe('Hurricane Watch');
      expect(adv.body.warnings[0].geometry).toMatchObject({
        type: 'LineString',
      });
    } finally {
      await kmzApp.close();
    }
  });

  it('rejects an unknown basin', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/ingest/run/xx')
      .set(...bearer(token) as [string, string])
      .set('x-api-key', adminKey)
      .expect(400);

    expect(res.body.message.length).toBeGreaterThan(0);
  });
});
