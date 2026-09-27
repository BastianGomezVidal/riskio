import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTestApp, seedStorm, registerAndLogin, bearer } from '../../../test/helpers/test-app.js';
import { NhcProvider } from '../feeds/providers/nhc/nhc.provider.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';

/**
 * History endpoint (integration): `GET /storm-history` paginates storms that are
 * no longer in the active NOAA feed, each with its total advisory count.
 *
 * A `NhcProvider` override keeps the scheduler from touching the database
 * with real feeds during the run.
 */

const ACTIVE = 'EP902026';
const INACTIVE_NEW = 'CP922026';
const INACTIVE_OLD = 'CP942026';

describe('History endpoint (integration)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp([
      {
        provide: NhcProvider,
        useValue: {
          fetchBasinSummary: () => Promise.reject(new Error('disabled')),
          fetchForecastAdvisory: () => Promise.reject(new Error('disabled')),
          fetchAdvisoryProduct: () => Promise.reject(new Error('disabled')),
        },
      },
    ]);

    await seedStorm(app, { atcfId: ACTIVE, name: 'Nora', basin: 'EP' }, []);

    await seedStorm(app, { atcfId: INACTIVE_NEW, name: 'Blas', basin: 'CP' }, [
      {
        advisory: {
          advisoryNumber: 5,
          issuedAt: new Date('2026-09-10T00:00:00Z'),
          rawText: null,
        },
        points: [
          {
            validAt: new Date('2026-09-10T06:00:00Z'),
            latitude: 15.2,
            longitude: -105.3,
            windSpeedKt: 45,
            pressureMb: 1000,
            category: 0,
          },
        ],
      },
    ]);

    await seedStorm(app, { atcfId: INACTIVE_OLD, name: null, basin: 'CP' }, []);

    const storms = app.get<Repository<Storm>>(getRepositoryToken(Storm));

    await storms.update(
      { atcfId: ACTIVE },
      { isActive: true, lastSeenInFeedAt: new Date('2026-09-12T00:00:00Z') },
    );
    await storms.update(
      { atcfId: INACTIVE_NEW },
      { isActive: false, lastSeenInFeedAt: new Date('2026-09-11T00:00:00Z') },
    );
    await storms.update(
      { atcfId: INACTIVE_OLD },
      { isActive: false, lastSeenInFeedAt: new Date('2026-09-12T00:00:00Z') },
    );

    token = await registerAndLogin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns only inactive storms', async () => {
    const res = await request(app.getHttpServer())
      .get('/storm-history')
      .set(...bearer(token) as [string, string])
      .query({ limit: 100 })
      .expect(200);

    const ids = res.body.data.map(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId,
    );

    expect(ids).toContain(INACTIVE_NEW);
    expect(ids).toContain(INACTIVE_OLD);
    expect(ids).not.toContain(ACTIVE);

    expect(
      res.body.data.every(
        (s: { storm: { isActive: boolean } }) => !s.storm.isActive,
      ),
    ).toBe(true);
  });

  it('orders by the feed pass that last saw each storm', async () => {
    const res = await request(app.getHttpServer())
      .get('/storm-history')
      .set(...bearer(token) as [string, string])
      .query({ limit: 100 })
      .expect(200);

    const ids = res.body.data.map(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId,
    );

    expect(ids.indexOf(INACTIVE_OLD)).toBeLessThan(ids.indexOf(INACTIVE_NEW));
  });

  it('reports the advisory count for each storm', async () => {
    const res = await request(app.getHttpServer())
      .get('/storm-history')
      .set(...bearer(token) as [string, string])
      .query({ limit: 100 })
      .expect(200);

    const withAdvisory = res.body.data.find(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId === INACTIVE_NEW,
    );
    const withoutAdvisory = res.body.data.find(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId === INACTIVE_OLD,
    );

    expect(withAdvisory.advisoryCount).toBe(1);
    expect(withoutAdvisory.advisoryCount).toBe(0);
  });

  it('paginates and reports internally consistent metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/storm-history')
      .set(...bearer(token) as [string, string])
      .query({ page: 1, limit: 2 })
      .expect(200);

    const { meta, data } = res.body;

    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(2);
    expect(meta.total).toBeGreaterThanOrEqual(2);
    expect(meta.pageCount).toBe(Math.ceil(meta.total / meta.limit));
    expect(meta.hasNextPage).toBe(meta.page * meta.limit < meta.total);

    expect(data).toHaveLength(Math.min(2, meta.total));
  });

  it('rejects an out-of-range limit', async () => {
    await request(app.getHttpServer())
      .get('/storm-history')
      .set(...bearer(token) as [string, string])
      .query({ limit: 101 })
      .expect(400);
  });

  it('rejects a non-positive page', async () => {
    await request(app.getHttpServer())
      .get('/storm-history')
      .set(...bearer(token) as [string, string])
      .query({ page: 0 })
      .expect(400);
  });
});
