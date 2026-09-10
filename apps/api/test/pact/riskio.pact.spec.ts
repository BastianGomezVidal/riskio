import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pactPkg from '@pact-foundation/pact';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.js';
import { NhcProvider } from '../../src/providers/nhc/nhc.provider.js';
import { Storm } from '../../src/storms/entities/storm.entity.js';
import { Advisory } from '../../src/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../src/forecast-points/entities/forecast-point.entity.js';
import { riskioClient } from './riskio-client.js';

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

const paginated = (item: Record<string, unknown>) => ({
  meta: {
    total: Matchers.integer(1),
    page: Matchers.integer(1),
    limit: Matchers.integer(20),
    pageCount: Matchers.integer(1),
    hasNextPage: Matchers.boolean(false),
  },
  data: Matchers.eachLike(item),
});

const pact = new PactV4(
  {
    consumer: CONSUMER,
    provider: PROVIDER,
    dir: PACT_DIR,
    spec: SpecificationVersion.SPECIFICATION_VERSION_V4,
  },
  { logLevel: 'error' as const },
);

describe('weather-dashboard <-> riskio-api consumer contract', () => {
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
      .uponReceiving('a request for the first page of storms')
      .withRequest('GET', '/storms', (b) =>
        b.query({ page: '1', limit: '20' }),
      )
      .willRespondWith(200, (b) => b.jsonBody(paginated(stormBody)))
      .executeTest(async (mockServer) => {
        const res = await riskioClient.listStorms(mockServer.url, {
          page: 1,
          limit: 20,
        });
        expect(res.meta.total).toBe(1);
        expect(res.data[0]).toMatchObject({
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
        b.jsonBody({ ...stormBody, advisories: Matchers.eachLike(advisoryBody) }),
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

  it('lists advisories for a storm', async () => {
    await pact
      .addInteraction()
      .given(`storm ${STORM_ID} exists with advisory 2`)
      .uponReceiving('a request for a storm advisories page')
      .withRequest('GET', `/storms/${STORM_ID}/advisories`, (b) =>
        b.query({ page: '1', limit: '20' }),
      )
      .willRespondWith(200, (b) => b.jsonBody(paginated(advisoryBody)))
      .executeTest(async (mockServer) => {
        const res = await riskioClient.listAdvisories(mockServer.url, STORM_ID, {
          page: 1,
          limit: 20,
        });
        expect(res.data[0].advisoryNumber).toBe(2);
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

  it('lists forecast points for an advisory', async () => {
    await pact
      .addInteraction()
      .given(`advisory ${ADVISORY_ID} has 2 forecast points`)
      .uponReceiving('a request for the forecast points page')
      .withRequest('GET', `/advisories/${ADVISORY_ID}/forecast-points`, (b) =>
        b.query({ page: '1', limit: '20' }),
      )
      .willRespondWith(200, (b) =>
        b.jsonBody(paginated(forecastPointBody)),
      )
      .executeTest(async (mockServer) => {
        const res = await riskioClient.listForecastPoints(
          mockServer.url,
          ADVISORY_ID,
          { page: 1, limit: 20 },
        );
        expect(res.data.length).toBeGreaterThanOrEqual(1);
        expect(res.data[0]).toMatchObject({
          latitude: 16.7,
          longitude: -118.5,
        });
      });
  });

  it('404s for an unknown advisory', async () => {
    await pact
      .addInteraction()
      .given('the advisory does not exist')
      .uponReceiving('a request for an advisory that does not exist')
      .withRequest(
        'GET',
        '/advisories/00000000-0000-0000-0000-000000000000',
      )
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
      .withRequest('GET', '/admin/ingest/run/ep')
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
      .withRequest('POST', '/admin/ingest/run')
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
      .withRequest('GET', '/admin/ingest/run/xx')
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
        readFileSync(join(__dirname, '..', 'fixtures', 'nhc-ep-active.xml'), 'utf8'),
      ),
    fetchForecastAdvisory: (_wallet: string) =>
      Promise.resolve(
        readFileSync(join(__dirname, '..', 'fixtures', 'tcm-ep4.xml'), 'utf8'),
      ),
  };

  const clearAllData = async () => {
    const storms = app.get(getRepositoryToken(Storm)) as Repository<Storm>;
    await storms.createQueryBuilder().delete().execute();
  };

  const seedStorm = async () => {
    await clearAllData();
    const storms = app.get(getRepositoryToken(Storm)) as Repository<Storm>;
    await storms.insert({ atcfId: STORM_ID, name: 'Lowell', basin: 'EP' });
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

  beforeAll(async () => {
    app = await createTestApp([{ provide: NhcProvider, useValue: nhcMock }]);
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