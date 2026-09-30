import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createTestApp,
  seedStorm,
  registerAndLogin,
  bearer,
} from '../../../../test/helpers/test-app.js';
import { NhcProvider } from '../../feeds/providers/nhc/nhc.provider.js';
import { Storm } from './entities/storm.entity.js';

/**
 * Storms endpoints (integration).
 *
 * Covers the active/detail surface introduced with the storm activity flags:
 * `GET /storms` only returns the current NOAA active set. The historical
 * complement lives in the history module (`GET /history`). A `NhcProvider`
 * override keeps the scheduler from touching the database with real feeds
 * during the run.
 */

const ACTIVE_NEW = 'EP902026';
const ACTIVE_OLD = 'AL912026';
const INACTIVE_NEW = 'CP922026';
const INACTIVE_MID = 'CP932026';
const INACTIVE_OLD = 'CP942026';

describe('Storms endpoints (integration)', () => {
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

    await seedStorm(app, { atcfId: ACTIVE_NEW, name: 'Nora', basin: 'EP' }, []);
    await seedStorm(app, { atcfId: ACTIVE_OLD, name: 'Karl', basin: 'AL' }, []);
    await seedStorm(
      app,
      { atcfId: INACTIVE_NEW, name: 'Blas', basin: 'CP' },
      [],
    );
    await seedStorm(app, { atcfId: INACTIVE_MID, name: null, basin: 'CP' }, []);
    await seedStorm(
      app,
      { atcfId: INACTIVE_OLD, name: 'Celia', basin: 'CP' },
      [],
    );

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

    token = await registerAndLogin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /storms returns only the active set, newest feed appearance first', async () => {
    const res = await request(app.getHttpServer())
      .get('/storms')
      .expect(200)
      .set(...(bearer(token) as [string, string]));

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

  it('GET /storms/:atcfId exposes the activity flags', async () => {
    const res = await request(app.getHttpServer())
      .get(`/storms/${INACTIVE_NEW}`)
      .set(...(bearer(token) as [string, string]))
      .expect(200);

    expect(res.body).toMatchObject({
      atcfId: INACTIVE_NEW,
      isActive: false,
      advisories: [],
    });
    expect(res.body.lastSeenInFeedAt).toMatch(/2026-09-11/);
  });

  it('returns 404 for an unknown storm', async () => {
    await request(app.getHttpServer())
      .get('/storms/ZZ999999')
      .expect(404)
      .set(...(bearer(token) as [string, string]));
  });
});
