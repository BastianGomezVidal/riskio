import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedStorm } from '../../test/helpers/test-app.js';

describe('Warnings endpoints (integration)', () => {
  let app: INestApplication;
  let advisoryId: string;

  beforeAll(async () => {
    app = await createTestApp();

    await seedStorm(app, { atcfId: 'AL112017', name: null, basin: 'AL' }, [
      {
        advisory: {
          advisoryNumber: 20,
          issuedAt: new Date('2017-09-08T02:33:27Z'),
          rawText: 'warnings advisory',
          warnings: [
            {
              warningType: 'Hurricane Watch',
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [-80.5, 25.9],
                  [-80.4, 26.1],
                ],
              },
            },
          ],
        },
        points: [],
      },
    ]);

    const adv = await request(app.getHttpServer())
      .get('/storms/AL112017/advisories')
      .expect(200);
    advisoryId = adv.body.data[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns warning segments as a GeoJSON FeatureCollection', async () => {
    const res = await request(app.getHttpServer())
      .get(`/advisories/${advisoryId}/warnings`)
      .expect(200);

    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features).toHaveLength(1);
    expect(res.body.features[0]).toEqual({
      type: 'Feature',
      properties: { warningType: 'Hurricane Watch' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-80.5, 25.9],
          [-80.4, 26.1],
        ],
      },
    });
  });

  it('returns an empty FeatureCollection when no warnings exist', async () => {
    await seedStorm(app, { atcfId: 'EP142026', name: null, basin: 'EP' }, [
      {
        advisory: {
          advisoryNumber: 9,
          issuedAt: new Date('2026-09-10T02:33:27Z'),
          rawText: 'no warnings',
        },
        points: [],
      },
    ]);
    const adv = await request(app.getHttpServer())
      .get('/storms/EP142026/advisories')
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/advisories/${adv.body.data[0].id}/warnings`)
      .expect(200);

    expect(res.body).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('returns 404 for an unknown advisory id', async () => {
    await request(app.getHttpServer())
      .get('/advisories/00000000-0000-0000-0000-000000000000/warnings')
      .expect(404);
  });
});
