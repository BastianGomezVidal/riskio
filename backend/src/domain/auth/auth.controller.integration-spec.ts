import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../../test/helpers/test-app.js';
import { MailerService } from './mailer.service.js';

describe('Auth controller (integration)', () => {
  let app: INestApplication;
  const email = 'forgot@test.local';
  const sentMails: Array<{ to: string; password: string }> = [];

  beforeAll(async () => {
    app = await createTestApp([
      {
        provide: MailerService,
        useValue: {
          sendTemporaryPassword: (to: string, password: string) => {
            sentMails.push({ to, password });
            return Promise.resolve();
          },
        },
      },
    ]);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email,
        password: 'original-password',
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an invalid email body with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('returns a neutral response for an unknown email without sending mail', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'missing@test.local' })
      .expect(200);

    // The response must not reveal whether the email exists.
    expect(res.body.message).toEqual(expect.any(String));
    expect(sentMails).toHaveLength(0);
  });

  it('resets the password and emails a temporary one that can log in', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);

    // The temporary password is delivered out of band, never in the body.
    expect(res.body).not.toHaveProperty('temporaryPassword');
    expect(res.body.message).toEqual(expect.any(String));

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe(email);
    const temporaryPassword = sentMails[0].password;
    expect(temporaryPassword).toEqual(expect.any(String));

    // Old password must no longer work…
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'original-password' })
      .expect(401);

    // …and the temporary password must.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: temporaryPassword })
      .expect(200);

    expect(login.body.accessToken).toEqual(expect.any(String));
  });
});
