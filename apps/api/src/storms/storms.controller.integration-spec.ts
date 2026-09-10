import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedStorm } from '../../test/helpers/test-app.js';

describe('Storms endpoints (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists storms with pagination metadata', async () => {
    await seedStorm(
      app,
      { atcfId: 'AL012026', name: 'Testi', basin: 'AL' },
      [],
    );

    const res = await request(app.getHttpServer())
      .get('/storms')
      .expect(200);

    expect(res.body.meta).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 20 }),
    );
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      atcfId: 'AL012026',
      name: 'Testi',
      basin: 'AL',
    });
  });

  it('returns a storm with its advisories by atcfId', async () => {
    await seedStorm(
      app,
      { atcfId: 'EP142026', name: null, basin: 'EP' },
      [
        {
          advisory: {
            advisoryNumber: 2,
            issuedAt: new Date('2026-09-10T02:33:27Z'),
            rawText: 'advisory text',
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
          ],
        },
      ],
    );

    const res = await request(app.getHttpServer())
      .get('/storms/EP142026')
      .expect(200);

    expect(res.body.atcfId).toBe('EP142026');
    expect(res.body.advisories).toHaveLength(1);
    expect(res.body.advisories[0].advisoryNumber).toBe(2);
  });

  it('returns 404 for an unknown storm', async () => {
    await request(app.getHttpServer())
      .get('/storms/ZZ999999')
      .expect(404);
  });

  it('paginates and enforces the max limit', async () => {
    // seed 3 storms for pagination coverage
    for (let i = 1; i <= 3; i++) {
      await seedStorm(
        app,
        { atcfId: `AL01202${6 + i}`, name: `Storm${i}`, basin: 'AL' },
        [],
      );
    }

    const page2 = await request(app.getHttpServer())
      .get('/storms?page=2&limit=2')
      .expect(200);
    expect(page2.body.meta.page).toBe(2);
    expect(page2.body.meta.hasNextPage).toBe(true);

    const tooBig = await request(app.getHttpServer())
      .get('/storms?limit=500')
      .expect(400);
    expect(tooBig.body.message.length).toBeGreaterThan(0);
  });

  it.each([
    ['page=0'],
    ['page=-1'],
    ['page=abc'],
    ['limit=0'],
    ['limit=-5'],
    ['limit=1.5'],
  ])('rejects malformed pagination (%s)', async (query) => {
    const res = await request(app.getHttpServer())
      .get(`/storms?${query}`)
      .expect(400);
    expect(res.body.message.length).toBeGreaterThan(0);
  });
});