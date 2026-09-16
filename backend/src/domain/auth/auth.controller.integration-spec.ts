import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../test/helpers/test-app.js';

describe('Auth controller (integration)', () => {
  let app: INestApplication;
  const email = 'forgot@test.local';

  beforeAll(async () => {
    app = await createTestApp();
    await request(app.getHttpServer()).post('/auth/register').send({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      password: 'original-password',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unknown email with 404', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'missing@test.local' })
      .expect(404);
  });

  it('rejects an invalid email body with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('resets the password and returns a temporary one that can log in', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);

    expect(res.body).toMatchObject({ email });
    expect(res.body.temporaryPassword).toEqual(expect.any(String));

    // Old password must no longer work…
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'original-password' })
      .expect(401);

    // …and the temporary password must.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: res.body.temporaryPassword })
      .expect(200);

    expect(login.body.accessToken).toEqual(expect.any(String));
  });
});