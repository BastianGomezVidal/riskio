import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../test/helpers/test-app.js';

describe('Health endpoint (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports ok with a reachable database', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
    expect(res.body.details.database.status).toBe('up');
  });
});