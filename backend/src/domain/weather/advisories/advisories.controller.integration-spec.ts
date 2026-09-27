import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  seedStorm,
  registerAndLogin,
  bearer,
  listAdvisoryIds,
} from '../../../../test/helpers/test-app.js';

describe('Advisories endpoints (integration)', () => {
  let app: INestApplication;
  let advisoryId: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();

    await seedStorm(app, { atcfId: 'EP142026', name: null, basin: 'EP' }, [
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
            windSpeedKt: 35,
            pressureMb: null,
            category: 0,
          },
          {
            validAt: new Date('2026-09-11T00:00:00Z'),
            latitude: 16.8,
            longitude: -121.1,
            windSpeedKt: 40,
            pressureMb: null,
            category: 0,
          },
        ],
      },
      {
        advisory: {
          advisoryNumber: 1,
          issuedAt: new Date('2026-09-10T00:00:00Z'),
          rawText: 'TCM advisory #1',
        },
        points: [],
      },
    ]);

    token = await registerAndLogin(app);
    advisoryId = (await listAdvisoryIds(app, 'EP142026', token))[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists advisories newest-first on the storm detail', async () => {
    // There is no GET /storms/:atcfId/advisories route. The list lives on the
    // storm as lightweight refs, so that is what this asserts.
    const res = await request(app.getHttpServer())
      .get('/storms/EP142026')
      .set(...(bearer(token) as [string, string]))
      .expect(200);

    expect(res.body.advisories).toHaveLength(2);
    // DESC order → advisory #2 first
    expect(res.body.advisories[0].advisoryNumber).toBe(2);
    expect(res.body.advisories[1].advisoryNumber).toBe(1);
  });

  it('returns an advisory with forecast points', async () => {
    const res = await request(app.getHttpServer())
      .get(`/advisories/${advisoryId}`)
      .set(...(bearer(token) as [string, string]))
      .expect(200);

    expect(res.body.advisoryNumber).toBe(2);
    expect(res.body.forecastPoints).toHaveLength(2);
    expect(res.body.forecastPoints[0]).toMatchObject({
      latitude: 16.7,
      longitude: -118.5,
      windSpeedKt: 35,
      category: 0,
    });
  });

  it('returns forecast points ordered by validAt ascending', async () => {
    const res = await request(app.getHttpServer())
      .get(`/advisories/${advisoryId}`)
      .set(...(bearer(token) as [string, string]))
      .expect(200);

    expect(res.body.forecastPoints).toHaveLength(2);
    expect(res.body.forecastPoints[0].validAt).toMatch(/12:00:00/);
  });

  it('rejects an unknown advisory id', async () => {
    await request(app.getHttpServer())
      .get('/advisories/00000000-0000-0000-0000-000000000000')
      .set(...(bearer(token) as [string, string]))
      .expect(404);
  });

  it('round-trips track and cone geometry stored on the advisory', async () => {
    const track = {
      type: 'LineString' as const,
      coordinates: [
        [-120.5, 16.5],
        [-122.5, 16.5],
      ],
    };
    const cone = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-120.5, 16.5],
          [-118.5, 15.5],
          [-120.5, 16.5],
        ],
      ],
    };
    await seedStorm(app, { atcfId: 'AL012026', name: 'Geo', basin: 'AL' }, [
      {
        advisory: {
          advisoryNumber: 3,
          issuedAt: new Date('2026-09-10T02:33:27Z'),
          rawText: 'geo advisory',
          track,
          cone,
        },
        points: [],
      },
    ]);

    const ids = await listAdvisoryIds(app, 'AL012026', token);
    const res = await request(app.getHttpServer())
      .get(`/advisories/${ids[0]}`)
      .set(...(bearer(token) as [string, string]))
      .expect(200);

    expect(res.body).toMatchObject({
      advisoryNumber: 3,
      track: expect.objectContaining({ type: 'LineString' }),
      cone: expect.objectContaining({ type: 'Polygon' }),
    });
    expect(res.body.track.coordinates).toHaveLength(2);
    expect(res.body.cone.coordinates[0]).toHaveLength(3);
  });
});
