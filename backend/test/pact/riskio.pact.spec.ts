import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import pactPkg from '@pact-foundation/pact';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTestApp, registerAndLogin } from '../helpers/test-app.js';
import { NhcProvider } from '../../src/domain/feeds/providers/nhc/nhc.provider.js';
import { Storm } from '../../src/domain/weather/storms/entities/storm.entity.js';
import { Advisory } from '../../src/domain/weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../src/domain/weather/advisories/entities/forecast-point.entity.js';
import { User } from '../../src/domain/auth/entities/user.entity.js';
import { ApiToken } from '../../src/domain/auth/entities/api-token.entity.js';
import { hashToken } from '../../src/domain/auth/auth.utils.js';
import {
  riskioClient,
  PACT_API_KEY,
  PACT_BEARER_TOKEN,
} from './riskio-client.js';

const { PactV4, Matchers, SpecificationVersion, Verifier } = pactPkg;

const CONSUMER = 'weather-dashboard';
const PROVIDER = 'riskio-api';
const PACT_DIR = join(__dirname, '..', 'pacts');
const PACT_FILE = join(PACT_DIR, `${CONSUMER}-${PROVIDER}.json`);

// Fixed example values shared between the consumer contract and the data the
// provider verification state handlers seed into the database.
const STORM_ID = 'EP142026';
const ADVISORY_ID = '11111111-1111-4111-8111-111111111111';
const ISSUED_AT = '2026-09-10T02:33:27.000Z';

const dt = Matchers.iso8601DateTimeWithMillis(ISSUED_AT);

const stormBody = {
  atcfId: Matchers.string(STORM_ID),
  name: Matchers.string('Lowell'),
  basin: Matchers.string('EP'),
  firstSeenAt: dt,
  lastSeenAt: dt,
  isActive: Matchers.boolean(true),
};

const advisoryBody = {
  id: Matchers.uuid(ADVISORY_ID),
  advisoryNumber: Matchers.integer(2),
  issuedAt: dt,
  rawText: Matchers.string('TCM - forecast advisory'),
  ingestedAt: dt,
};

const forecastPointBody = {
  id: Matchers.uuid('22222222-2222-4222-8222-222222222222'),
  validAt: dt,
  latitude: Matchers.decimal(16.7),
  longitude: Matchers.decimal(-118.5),
  windSpeedKt: Matchers.integer(35),
  pressureMb: Matchers.integer(1006),
  category: Matchers.integer(1),
};

const ingestReportBody = {
  basin: Matchers.string('ep'),
  stormsSeen: Matchers.integer(1),
  stormsUpserted: Matchers.integer(1),
  advisoriesInserted: Matchers.integer(1),
  advisoriesSkipped: Matchers.integer(0),
  forecastPointsInserted: Matchers.integer(5),
  errors: Matchers.like([]),
};

const pact = new PactV4({
  consumer: CONSUMER,
  provider: PROVIDER,
  dir: PACT_DIR,
  spec: SpecificationVersion.SPECIFICATION_VERSION_V4,
  logLevel: 'error' as const,
});

describe('weather-dashboard <-> riskio-api consumer contract', () => {
  beforeAll(() => {
    /*
     * Delete the pact file before writing it.
     *
     * @pact-foundation/pact *merges* into an existing pact file: interactions
     * that are no longer declared are kept. So the file on disk had grown to
     * carry both `a request for a storm advisories list` and `a request for the
     * forecast points list` — two interactions describing routes that never
     * existed, kept alive by the merge and re-verified on every run. Deleting
     * first makes the file a function of the specs in this file and nothing
     * else, which is the only way it can be trusted as a contract.
     */
    rmSync(PACT_FILE, { force: true });
  });

  it('reads health', async () => {
    await pact
      .addInteraction()
      .uponReceiving('a request for the health probe')
      .withRequest('GET', '/health')
      .willRespondWith(200, (b) =>
        b.jsonBody({
          status: Matchers.string('ok'),
          info: {
            database: {
              status: Matchers.string('up'),
              responseTime: Matchers.integer(2),
            },
          },
          error: Matchers.like({}),
          details: {
            database: {
              status: Matchers.string('up'),
              responseTime: Matchers.integer(2),
            },
          },
        }),
      )
      .executeTest(async (mockServer) => {
        const health = await riskioClient.getHealth(mockServer.url);
        expect(health.status).toBe('ok');
        expect(health.details.database.status).toBe('up');
      });
  });

  it('lists storms', async () => {
    await pact
      .addInteraction()
      .given('there are storms in the database')
      .uponReceiving('a request for the list of storms')
      .withRequest('GET', '/storms')
      .willRespondWith(200, (b) => b.jsonBody(Matchers.eachLike(stormBody)))
      .executeTest(async (mockServer) => {
        const res = await riskioClient.listStorms(mockServer.url);
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          atcfId: STORM_ID,
          basin: 'EP',
        });
      });
  });

  it('gets a storm with its advisories', async () => {
    await pact
      .addInteraction()
      .given(`storm ${STORM_ID} exists with advisory 2`)
      .uponReceiving('a request for a single storm by atcfId')
      .withRequest('GET', `/storms/${STORM_ID}`)
      .willRespondWith(200, (b) =>
        b.jsonBody({
          ...stormBody,
          advisories: Matchers.eachLike(advisoryBody),
        }),
      )
      .executeTest(async (mockServer) => {
        const storm = await riskioClient.getStorm(mockServer.url, STORM_ID);
        expect(storm.atcfId).toBe(STORM_ID);
        expect(Array.isArray(storm.advisories)).toBe(true);
        expect(storm.advisories[0].advisoryNumber).toBe(2);
      });
  });

  it('404s for an unknown storm', async () => {
    await pact
      .addInteraction()
      .given('the storm ZZ999999 does not exist')
      .uponReceiving('a request for a storm that does not exist')
      .withRequest('GET', '/storms/ZZ999999')
      .willRespondWith(404)
      .executeTest(async (mockServer) => {
        await expect(
          riskioClient.getStorm(mockServer.url, 'ZZ999999'),
        ).rejects.toThrow(/404/);
      });
  });

  /*
   * The advisory-by-number route, not an advisories list.
   *
   * The contract used to describe `GET /storms/:atcfId/advisories`, which
   * returns 404: the API never had that route. It is
   * `/storms/:atcfId/advisories/:n`, with the number required, because a storm
   * accumulates twenty advisories and "the advisory" is ambiguous. `latest` is
   * the value the frontend actually sends, so that is what is pinned here.
   */
  it("gets a storm's latest advisory", async () => {
    await pact
      .addInteraction()
      .given(`storm ${STORM_ID} exists with advisory 2`)
      .uponReceiving('a request for the latest advisory of a storm')
      .withRequest('GET', `/storms/${STORM_ID}/advisories/latest`)
      .willRespondWith(200, (b) =>
        b.jsonBody({
          ...advisoryBody,
          forecastPoints: Matchers.eachLike(forecastPointBody),
          warnings: Matchers.eachLike({}),
          track: Matchers.like(null),
          cone: Matchers.like(null),
        }),
      )
      .executeTest(async (mockServer) => {
        const advisory = await riskioClient.getAdvisoryForStorm(
          mockServer.url,
          STORM_ID,
          'latest',
        );
        expect(advisory.advisoryNumber).toBe(2);
        expect(Array.isArray(advisory.forecastPoints)).toBe(true);
      });
  });

  it('gets an advisory with its forecast points', async () => {
    await pact
      .addInteraction()
      .given(`advisory ${ADVISORY_ID} has 2 forecast points`)
      .uponReceiving('a request for a single advisory by id')
      .withRequest('GET', `/advisories/${ADVISORY_ID}`)
      .willRespondWith(200, (b) =>
        b.jsonBody({
          ...advisoryBody,
          forecastPoints: Matchers.eachLike(forecastPointBody),
        }),
      )
      .executeTest(async (mockServer) => {
        const advisory = await riskioClient.getAdvisory(
          mockServer.url,
          ADVISORY_ID,
        );
        expect(advisory.id).toBe(ADVISORY_ID);
        expect(advisory.forecastPoints.length).toBeGreaterThanOrEqual(1);
        expect(advisory.forecastPoints[0]).toMatchObject({
          latitude: 16.7,
          windSpeedKt: 35,
        });
      });
  });

  /*
   * Forecast points are part of the advisory detail, not a second call.
   *
   * The contract used to describe `GET /advisories/:id/forecast-points`, which
   * returns 404 and was never implemented. The detail endpoint already embeds
   * `forecastPoints`, so the assertion that matters — that the points arrive
   * with the advisory — is made there instead. Splitting it into its own
   * interaction would have pinned a route the API is better off not having.
   */
  it('404s for an unknown advisory', async () => {
    await pact
      .addInteraction()
      .given('the advisory does not exist')
      .uponReceiving('a request for an advisory that does not exist')
      .withRequest('GET', '/advisories/00000000-0000-0000-0000-000000000000')
      .willRespondWith(404)
      .executeTest(async (mockServer) => {
        await expect(
          riskioClient.getAdvisory(
            mockServer.url,
            '00000000-0000-0000-0000-000000000000',
          ),
        ).rejects.toThrow(/404/);
      });
  });

  it('runs ingestion for a single basin', async () => {
    await pact
      .addInteraction()
      .given('NOAA reports the EP basin has one active storm')
      .uponReceiving('a request to ingest the ep basin')
      .withRequest('POST', '/admin/ingest/run/ep', (b) =>
        b.headers({ 'x-api-key': PACT_API_KEY }),
      )
      .willRespondWith(200, (b) => b.jsonBody(ingestReportBody))
      .executeTest(async (mockServer) => {
        const report = await riskioClient.runBasinIngest(mockServer.url, 'ep');
        expect(report.basin).toBe('ep');
        expect(report.advisoriesInserted).toBeGreaterThanOrEqual(0);
        expect(report.errors).toEqual([]);
      });
  });

  it('runs ingestion for all basins', async () => {
    await pact
      .addInteraction()
      .given('NOAA reports the EP basin has one active storm')
      .uponReceiving('a request to ingest all basins')
      .withRequest('POST', '/admin/ingest/run', (b) =>
        b.headers({ 'x-api-key': PACT_API_KEY }),
      )
      .willRespondWith(200, (b) =>
        b.jsonBody(Matchers.eachLike(ingestReportBody)),
      )
      .executeTest(async (mockServer) => {
        const reports = await riskioClient.runAllIngest(mockServer.url);
        expect(reports.length).toBeGreaterThanOrEqual(1);
        expect(reports[0]).toMatchObject({
          advisoriesInserted: 1,
          errors: [],
        });
      });
  });

  it('rejects an unknown basin with 400', async () => {
    await pact
      .addInteraction()
      .uponReceiving('a request to ingest an unknown basin')
      .withRequest('POST', '/admin/ingest/run/xx', (b) =>
        b.headers({ 'x-api-key': PACT_API_KEY }),
      )
      .willRespondWith(400)
      .executeTest(async (mockServer) => {
        await expect(
          riskioClient.runBasinIngest(mockServer.url, 'xx'),
        ).rejects.toThrow(/400/);
      });
  });
});

describe('riskio-api provider verification', () => {
  let app: INestApplication;
  let baseUrl: string;

  const nhcMock = {
    fetchBasinSummary: (_basin: string) =>
      Promise.resolve(
        readFileSync(
          join(__dirname, '..', 'fixtures', 'nhc-ep-active.xml'),
          'utf8',
        ),
      ),
    fetchForecastAdvisory: (_wallet: string) =>
      Promise.resolve(
        readFileSync(join(__dirname, '..', 'fixtures', 'tcm-ep4.xml'), 'utf8'),
      ),
  };

  /*
   * Deletes the storm graph in FK order, children first.
   *
   * This used to delete `storms` alone, which worked only because nothing after
   * it ever ran: every guarded route returned 401 before a state handler was
   * reached. Once the verifier was given credentials, the handlers started
   * running in sequence, and the second one hit the foreign key — advisories
   * and forecast points from the previous interaction still pointed at a storm
   * that no longer existed.
   *
   * It failed as "One or more of the setup state change handlers has failed",
   * attached to every interaction, which points at the verifier rather than at
   * the fixture that actually broke.
   */
  const clearAllData = async () => {
    const points = app.get(
      getRepositoryToken(ForecastPoint),
    ) as Repository<ForecastPoint>;
    const advisories = app.get(
      getRepositoryToken(Advisory),
    ) as Repository<Advisory>;
    const storms = app.get(getRepositoryToken(Storm)) as Repository<Storm>;

    await points.createQueryBuilder().delete().execute();
    await advisories.createQueryBuilder().delete().execute();
    await storms.createQueryBuilder().delete().execute();
  };

  /*
   * Seeds an admin account whose stored token hash matches the token the
   * consumer sends in `x-api-key`, so the guarded ingestion endpoints
   * authenticate during provider verification.
   */
  const seedPactAdminToken = async () => {
    const users = app.get(getRepositoryToken(User)) as Repository<User>;
    const tokens = app.get(
      getRepositoryToken(ApiToken),
    ) as Repository<ApiToken>;

    await users.delete({ email: 'pact-admin@test.local' });

    const admin = await users.save(
      users.create({
        email: 'pact-admin@test.local',
        role: 'admin',
        firstName: 'Pact',
        lastName: 'Admin',
        phone: null,
        passwordHash: null,
      }),
    );

    await tokens.insert({
      user: { id: admin.id } as User,
      name: 'pact',
      tokenHash: hashToken(PACT_API_KEY),
      prefix: 'pact',
    });
  };

  const seedStorm = async () => {
    await clearAllData();
    const storms = app.get(getRepositoryToken(Storm)) as Repository<Storm>;
    await storms.insert({
      atcfId: STORM_ID,
      name: 'Lowell',
      basin: 'EP',
      isActive: true,
      lastSeenInFeedAt: new Date(ISSUED_AT),
    });
  };

  const seedAdvisory = async () => {
    await seedStorm();
    const advisories = app.get(
      getRepositoryToken(Advisory),
    ) as Repository<Advisory>;
    await advisories.insert({
      id: ADVISORY_ID,
      advisoryNumber: 2,
      issuedAt: new Date(ISSUED_AT),
      rawText: 'TCM - forecast advisory',
      storm: { atcfId: STORM_ID } as Storm,
    });
  };

  const seedAdvisoryWithPoints = async () => {
    await seedAdvisory();
    const points = app.get(
      getRepositoryToken(ForecastPoint),
    ) as Repository<ForecastPoint>;
    await points.insert([
      {
        advisory: { id: ADVISORY_ID } as Advisory,
        validAt: new Date('2026-09-10T12:00:00.000Z'),
        latitude: 16.7,
        longitude: -118.5,
        windSpeedKt: 35,
        pressureMb: 1006,
        category: 1,
      },
      {
        advisory: { id: ADVISORY_ID } as Advisory,
        validAt: new Date('2026-09-11T00:00:00.000Z'),
        latitude: 16.8,
        longitude: -121.1,
        windSpeedKt: 40,
        pressureMb: 1004,
        category: 1,
      },
    ]);
  };

  let bearerToken: string;

  beforeAll(async () => {
    app = await createTestApp([{ provide: NhcProvider, useValue: nhcMock }]);
    await seedPactAdminToken();

    /*
     * A real access token, minted the way a client gets one.
     *
     * The verifier needs a valid JWT for the guarded read routes, and the
     * obvious shortcuts both fail: a made-up string is rejected by the
     * JwtAuthGuard, and reusing PACT_API_KEY does not work either because that
     * is an API token checked against its own hash, not a JWT. Registering and
     * logging in goes through the same path production uses, so the contract is
     * verified against the auth that actually ships.
     */
    bearerToken = await registerAndLogin(app, 'pact-reader@test.local');

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('has a pact file produced by the consumer', () => {
    expect(readdirSync(PACT_DIR).map((f) => join(PACT_DIR, f))).toContain(
      PACT_FILE,
    );
  });

  it('verifies the consumer contract against the running provider', async () => {
    const verifier = new Verifier({
      provider: PROVIDER,
      providerBaseUrl: baseUrl,
      pactUrls: [PACT_FILE],
      logLevel: 'error' as const,
      /*
       * The verifier replays the recorded interactions against the running app,
       * and a recorded interaction is only a path and a body. It carries no
       * credentials, so every guarded route answered 401 and the mismatch was
       * reported as a body shape error, which is a misleading way to learn that
       * a header was missing.
       *
       * A contract test that cannot authenticate proves nothing about the
       * contract. Injecting the header here is what makes the verification
       * reach the controller at all.
       */
      requestFilter: (req) => ({
        ...req,
        headers: {
          ...req.headers,
          authorization: `Bearer ${bearerToken}`,
          'x-api-key': PACT_API_KEY,
        },
      }),
      stateHandlers: {
        'there are storms in the database': seedStorm,
        'storm EP142026 exists with advisory 2': seedAdvisory,
        'advisory 11111111-1111-4111-8111-111111111111 has 2 forecast points':
          seedAdvisoryWithPoints,
        'the storm ZZ999999 does not exist': clearAllData,
        'the advisory does not exist': clearAllData,
        'NOAA reports the EP basin has one active storm': clearAllData,
      },
    });

    const result = await verifier.verifyProvider();
    expect(result).toContain('Verifying a pact');
  });
});
