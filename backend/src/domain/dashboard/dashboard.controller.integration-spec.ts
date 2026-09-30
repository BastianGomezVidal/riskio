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
} from '../../../test/helpers/test-app.js';
import { Storm } from '../weather/storms/entities/storm.entity.js';

describe('Dashboard summary endpoint (integration)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Named storm with two advisories; latest (#2) reaches hurricane category.
    await seedStorm(app, { atcfId: 'EP142026', name: 'Odile', basin: 'EP' }, [
      {
        advisory: {
          advisoryNumber: 1,
          issuedAt: new Date('2026-09-10T00:00:00Z'),
          rawText: 'TCM advisory #1',
        },
        points: [],
      },
      {
        advisory: {
          advisoryNumber: 2,
          issuedAt: new Date('2026-09-10T02:33:27Z'),
          rawText: 'TCM advisory #2',
        },
        points: [
          {
            validAt: new Date('2026-09-10T12:00:00Z'),
            latitude: 16.7,
            longitude: -118.5,
            windSpeedKt: 100,
            pressureMb: null,
            category: 2,
          },
        ],
      },
    ]);

    // Unnamed storm with tropical-storm-strength winds only.
    await seedStorm(app, { atcfId: 'AL052026', name: null, basin: 'AL' }, [
      {
        advisory: {
          advisoryNumber: 10,
          issuedAt: new Date('2026-09-11T00:00:00Z'),
          rawText: 'TCM advisory #10',
        },
        points: [
          {
            validAt: new Date('2026-09-11T12:00:00Z'),
            latitude: 18.2,
            longitude: -62.5,
            windSpeedKt: 40,
            pressureMb: null,
            category: 0,
          },
          {
            validAt: new Date('2026-09-12T00:00:00Z'),
            latitude: 18.4,
            longitude: -63.1,
            windSpeedKt: 25,
            pressureMb: null,
            category: 0,
          },
        ],
      },
    ]);

    // Storm without any advisory yet.
    await seedStorm(app, { atcfId: 'CP072026', name: 'Zeta', basin: 'CP' }, []);

    // Storm that dropped out of the active feed: seeded then flipped inactive.
    await seedStorm(
      app,
      { atcfId: 'CP082026', name: 'Ghost', basin: 'CP' },
      [],
    );
    await app
      .get<Repository<Storm>>(getRepositoryToken(Storm))
      .update({ atcfId: 'CP082026' }, { isActive: false });

    token = await registerAndLogin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns season totals and per-storm latest-advisory summaries', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(...bearer(token))
      .expect(200);

    expect(res.body.generatedAt).toEqual(expect.any(String));
    // pacific/atlantic came with the per-basin totals in 4e425ae; the spec
    // predates them and was failing on the two extra keys.
    expect(res.body.totals).toEqual({
      events: 3,
      named: 2,
      hurricanes: 1,
      ace: 1.2,
      pacific: 2,
      atlantic: 1,
    });

    expect(res.body.storms).toHaveLength(3);
  });

  it('picks the newest advisory per storm', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(...bearer(token))
      .expect(200);

    const odile = res.body.storms.find(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId === 'EP142026',
    );

    expect(odile.latestAdvisory.advisoryNumber).toBe(2);
    expect(odile.latestAdvisory.forecastPoints).toHaveLength(1);
    expect(odile.latestAdvisory.forecastPoints[0]).toMatchObject({
      windSpeedKt: 100,
      category: 3,
    });
    expect(odile.latestAdvisory.issuedAt).toMatch(/02:33:27/);
  });

  it('exposes low-intensity points without inflating totals', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(...bearer(token))
      .expect(200);

    const al = res.body.storms.find(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId === 'AL052026',
    );

    expect(al.latestAdvisory.advisoryNumber).toBe(10);
    expect(al.latestAdvisory.forecastPoints).toHaveLength(2);
    // Wind speed 40 kt → 40² / 10_000 = 0.16 in ACE; category 0 → not a hurricane.
    expect(res.body.totals.hurricanes).toBe(1);
  });

  it('sets latestAdvisory to null for storms without advisories', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(...bearer(token))
      .expect(200);

    const zeta = res.body.storms.find(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId === 'CP072026',
    );

    expect(zeta.latestAdvisory).toBeNull();
    // Named counts even without an advisory.
    expect(res.body.totals.named).toBe(2);
  });

  it('excludes storms that are no longer active', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set(...bearer(token))
      .expect(200);

    const ghost = res.body.storms.find(
      (s: { storm: { atcfId: string } }) => s.storm.atcfId === 'CP082026',
    );

    expect(ghost).toBeUndefined();
    expect(res.body.storms).toHaveLength(3);
    // pacific/atlantic came with the per-basin totals in 4e425ae; the spec
    // predates them and was failing on the two extra keys.
    expect(res.body.totals).toEqual({
      events: 3,
      named: 2,
      hurricanes: 1,
      ace: 1.2,
      pacific: 2,
      atlantic: 1,
    });
  });
});
