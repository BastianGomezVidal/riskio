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

/**
 * Warning segments on the advisory (integration).
 *
 * This used to describe a `GET /advisories/:id/warnings` route returning a
 * GeoJSON FeatureCollection. That route does not exist in this API and never
 * did, and nothing consumed it. Warnings are exposed the way the frontend
 * actually reads them: embedded in the advisory detail, each with its id, its
 * type and its geometry.
 *
 * The geometry assertions are the point of the rewrite. The web client draws
 * these segments on the map, and for a while the Zod schema dropped the
 * geometry on the way in, so the lines silently never rendered even though the
 * server had been sending them. A test that only checked the count would not
 * have caught it.
 */
describe('Warning segments (integration)', () => {
  let app: INestApplication;
  let token: string;
  let withWarnings: string;
  let withoutWarnings: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await registerAndLogin(app);

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
            {
              warningType: 'Hurricane Warning',
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [-80.4, 26.1],
                  [-80.3, 26.4],
                ],
              },
            },
          ],
        },
        points: [],
      },
    ]);

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

    withWarnings = (await listAdvisoryIds(app, 'AL112017', token))[0];
    withoutWarnings = (await listAdvisoryIds(app, 'EP142026', token))[0];
  });

  afterAll(async () => {
    await app.close();
  });

  const getAdvisory = (id: string) =>
    request(app.getHttpServer())
      .get(`/advisories/${id}`)
      .set(...bearer(token));

  it('returns each warning with its type and geometry', async () => {
    const res = await getAdvisory(withWarnings).expect(200);

    expect(res.body.warnings).toHaveLength(2);
    expect(res.body.warnings[0]).toMatchObject({
      warningType: 'Hurricane Watch',
      geometry: { type: 'LineString' },
    });
  });

  it('round-trips the warning coordinates intact', async () => {
    const res = await getAdvisory(withWarnings).expect(200);

    // The map draws these, so a mangled coordinate is a visible defect, not a
    // cosmetic one.
    expect(res.body.warnings[0].geometry.coordinates).toEqual([
      [-80.5, 25.9],
      [-80.4, 26.1],
    ]);
  });

  it('keeps every segment rather than one per type', async () => {
    const res = await getAdvisory(withWarnings).expect(200);

    // The client dedupes by type for the tags but draws one line per segment.
    expect(
      res.body.warnings.map((w: { warningType: string }) => w.warningType),
    ).toEqual(['Hurricane Watch', 'Hurricane Warning']);
  });

  it('returns an empty array when the advisory has no warnings', async () => {
    const res = await getAdvisory(withoutWarnings).expect(200);

    expect(res.body.warnings).toEqual([]);
  });

  it('exposes the same segments on the storm-scoped advisory route', async () => {
    const res = await request(app.getHttpServer())
      .get('/storms/AL112017/advisories/latest')
      .set(...bearer(token))
      .expect(200);

    expect(res.body.advisory.warnings).toHaveLength(2);
    expect(res.body.advisory.warnings[0].geometry.coordinates).toHaveLength(2);
  });
});
