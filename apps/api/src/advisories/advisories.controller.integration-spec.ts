import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedStorm } from '../../test/helpers/test-app.js';

describe('Advisories & forecast-points endpoints (integration)', () => {
  let app: INestApplication;
  let advisoryId: string;
  let forecastPointIds: string[];

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

    const adv = await request(app.getHttpServer())
      .get('/storms/EP142026/advisories')
      .expect(200);
    advisoryId = adv.body.data[0].id;

    const pts = await request(app.getHttpServer())
      .get(`/advisories/${advisoryId}/forecast-points`)
      .expect(200);
    forecastPointIds = pts.body.data.map((p: { id: string }) => p.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists advisories newest-first with pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/storms/EP142026/advisories')
      .expect(200);

    expect(res.body.meta.total).toBe(2);
    // DESC order → advisory #2 first
    expect(res.body.data[0].advisoryNumber).toBe(2);
    expect(res.body.data[1].advisoryNumber).toBe(1);
  });

  it('returns an advisory with forecast points', async () => {
    const res = await request(app.getHttpServer())
      .get(`/advisories/${advisoryId}`)
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

  it('lists forecast points ordered by validAt ascending', async () => {
    const res = await request(app.getHttpServer())
      .get(`/advisories/${advisoryId}/forecast-points`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].validAt).toMatch(/12:00:00/);
  });

  it('contains the correct fields group', async () => {
    const id = forecastPointIds[0];
    const res = await request(app.getHttpServer())
      .get(`/advisories/${advisoryId}/forecast-points`)
      .expect(200);

    expect(res.body.data.map((p: { id: string }) => p.id)).toContain(id);
  });

  it('rejects an unknown advisory id', async () => {
    await request(app.getHttpServer())
      .get('/advisories/00000000-0000-0000-0000-000000000000')
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

    const res = await request(app.getHttpServer())
      .get('/storms/AL012026/advisories')
      .expect(200);

    expect(res.body.data[0]).toMatchObject({
      advisoryNumber: 3,
      track: expect.objectContaining({ type: 'LineString' }),
      cone: expect.objectContaining({ type: 'Polygon' }),
    });
    expect(res.body.data[0].track.coordinates).toHaveLength(2);
    expect(res.body.data[0].cone.coordinates[0]).toHaveLength(3);
  });
});
