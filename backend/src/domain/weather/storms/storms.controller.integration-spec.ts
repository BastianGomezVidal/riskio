import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTestApp, seedStorm } from '../../../../test/helpers/test-app.js';
import { NhcProvider } from '../../feeds/providers/nhc/nhc.provider.js';
import { Storm } from './entities/storm.entity.js';

/**
 * Storms endpoints (integration).
 *
 * Covers the active/history split introduced with the storm activity flags:
 * `GET /storms` only returns the current NOAA active set, while
 * `GET /storms/history` paginates the rest. A `NhcProvider` override keeps
 * the scheduler from touching the database with real feeds during the run.
 */

const ACTIVE_NEW = 'EP902026';
const ACTIVE_OLD = 'AL912026';
const INACTIVE_NEW = 'CP922026';
const INACTIVE_MID = 'CP932026';
const INACTIVE_OLD = 'CP942026';

describe('Storms endpoints (integration)', () => {
  let app: INestApplication;

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

    await seedStorm(app, { atcfId: ACTIVE_NEW, name: 'Nora', basin: 'EP' }, []);
    await seedStorm(app, { atcfId: ACTIVE_OLD, name: 'Karl', basin: 'AL' }, []);
    await seedStorm(app, { atcfId: INACTIVE_NEW, name: 'Blas', basin: 'CP' }, []);
    await seedStorm(app, { atcfId: INACTIVE_MID, name: null, basin: 'CP' }, []);
    await seedStorm(app, { atcfId: INACTIVE_OLD, name: 'Celia', basin: 'CP' }, []);

    const storms = app.get<Repository<Storm>>(getRepositoryToken(Storm));

    await storms.update(
      { atcfId: ACTIVE_NEW },
      { isActive: true, lastSeenInFeedAt: new Date('2026-09-12T00:00:00Z') },
    );
    await storms.update(
      { atcfId: ACTIVE_OLD },
      { isActive: true, lastSeenInFeedAt: new Date('2026-09-10T00:00:00Z') },
    );
    await storms.update(
      { atcfId: INACTIVE_NEW },
      { isActive: false, lastSeenInFeedAt: new Date('2026-09-11T00:00:00Z') },
    );
    await storms.update(
      { atcfId: INACTIVE_MID },
      { isActive: false, lastSeenInFeedAt: new Date('2026-09-11T00:00:00Z') },
    );
    await storms.update(
      { atcfId: INACTIVE_OLD },
      { isActive: false, lastSeenInFeedAt: new Date('2026-09-12T00:00:00Z') },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /storms returns only the active set, newest feed appearance first', async () => {
    const res = await request(app.getHttpServer()).get('/storms').expect(200);

    const ids = res.body.map((s: { atcfId: string }) => s.atcfId);

    expect(ids).toContain(ACTIVE_NEW);
    expect(ids).toContain(ACTIVE_OLD);

    expect(ids).not.toContain(INACTIVE_NEW);
    expect(ids).not.toContain(INACTIVE_MID);
    expect(ids).not.toContain(INACTIVE_OLD);

    expect(res.body.every((s: { isActive: boolean }) => s.isActive)).toBe(true);

    // ACTIVE_NEW was seen in a later feed pass than ACTIVE_OLD.
    expect(ids.indexOf(ACTIVE_NEW)).toBeLessThan(ids.indexOf(ACTIVE_OLD));
  });

  it('GET /storms/history returns only inactive storms', async () => {
    const res = await request(app.getHttpServer())
      .get('/storms/history')
      .query({ limit: 100 })
      .expect(200);

    const ids = res.body.data.map((s: { atcfId: string }) => s.atcfId);

    expect(ids).toContain(INACTIVE_NEW);
    expect(ids).toContain(INACTIVE_MID);
    expect(ids).toContain(INACTIVE_OLD);

    expect(ids).not.toContain(ACTIVE_NEW);
    expect(ids).not.toContain(ACTIVE_OLD);

    expect(
      res.body.data.every((s: { isActive: boolean }) => !s.isActive),
    ).toBe(true);
  });

  it('orders history by the feed pass that last saw each storm', async () => {
    const res = await request(app.getHttpServer())
      .get('/storms/history')
      .query({ limit: 100 })
      .expect(200);

    const ids = res.body.data.map((s: { atcfId: string }) => s.atcfId);

    expect(ids.indexOf(INACTIVE_OLD)).toBeLessThan(ids.indexOf(INACTIVE_NEW));
  });

  it('paginates history and reports internally consistent metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/storms/history')
      .query({ page: 1, limit: 2 })
      .expect(200);

    const { meta, data } = res.body;

    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(2);
    expect(meta.total).toBeGreaterThanOrEqual(3);
    expect(meta.pageCount).toBe(Math.ceil(meta.total / meta.limit));
    expect(meta.hasNextPage).toBe(meta.page * meta.limit < meta.total);

    expect(data).toHaveLength(2);
  });

  it('rejects an out-of-range limit', async () => {
    await request(app.getHttpServer())
      .get('/storms/history')
      .query({ limit: 101 })
      .expect(400);
  });

  it('rejects a non-positive page', async () => {
    await request(app.getHttpServer())
      .get('/storms/history')
      .query({ page: 0 })
      .expect(400);
  });

  it('GET /storms/:atcfId exposes the activity flags', async () => {
    const res = await request(app.getHttpServer())
      .get(`/storms/${INACTIVE_NEW}`)
      .expect(200);

    expect(res.body).toMatchObject({
      atcfId: INACTIVE_NEW,
      isActive: false,
      advisories: [],
    });
    expect(res.body.lastSeenInFeedAt).toMatch(/2026-09-11/);
  });

  it('returns 404 for an unknown storm', async () => {
    await request(app.getHttpServer()).get('/storms/ZZ999999').expect(404);
  });
});
