import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../../test/helpers/test-app.js';
import { MailerService } from './mailer.service.js';

describe('Auth controller (integration)', () => {
  let app: INestApplication;
  const email = 'forgot@test.local';
  const sentMails: Array<{ to: string; link: string }> = [];

  beforeAll(async () => {
    app = await createTestApp([
      {
        provide: MailerService,
        useValue: {
          sendPasswordResetLink: (to: string, link: string) => {
            sentMails.push({ to, link });
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

  it('emails a reset link without touching the current password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);

    // The link is delivered out of band, never in the body.
    expect(res.body).not.toHaveProperty('token');
    expect(res.body.message).toEqual(expect.any(String));

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe(email);
    expect(sentMails[0].link).toContain('/reset-password?token=');

    // Requesting a link must not invalidate the password the user has now.
    // This is what the previous temporary-password flow got wrong: it
    // replaced the password on the spot and only logged the new one.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'original-password' })
      .expect(200);
  });

  it('sets a new password from the link, and refuses to reuse it', async () => {
    const token = new URL(sentMails[0].link).searchParams.get('token')!;

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'brand-new-password' })
      .expect(200);

    expect(res.body.message).toEqual(expect.any(String));

    // The chosen password is the one that now works…
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'original-password' })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'brand-new-password' })
      .expect(200);

    expect(login.body.accessToken).toEqual(expect.any(String));

    // …and the link is spent, so a copy in a mailbox cannot reset again.
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'attacker-password' })
      .expect(400);
  });

  it('rejects an unknown token without saying why', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'whatever-password' })
      .expect(400);

    expect(res.body.message).toEqual(expect.any(String));
  });
});
