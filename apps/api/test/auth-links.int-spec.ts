import { apiErrorSchema, verifyEmailResponseSchema } from '@beso/shared';
import request from 'supertest';
import { EmailTokensService } from '../src/auth/email-tokens.service.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { type TestAgent, createUser } from './setup/factories.js';
import { tokenIn, waitForEmail } from './setup/outbox.js';

/**
 * What a mailed confirmation link may still do once the address was confirmed another way
 * (review L1). Its own app, so the per-address limits of `verify-email` are fresh.
 */
describe('confirmation links after a password reset', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('are spent by the reset, and never sign in for an address already confirmed', async () => {
    const waiting = await createUser(t.prisma, { emailVerifiedAt: null });
    const emailTokens = t.app.get(EmailTokensService);
    const confirmLink = await emailTokens.issue(waiting.id, 'verify_email');
    await request(t.server)
      .post('/api/v1/auth/forgot-password')
      .send({ email: waiting.email })
      .expect(204);
    const mail = await waitForEmail(waiting.email, /Reset your/);
    const browser: TestAgent = request.agent(t.server);
    await browser
      .post('/api/v1/auth/reset-password')
      .send({ token: tokenIn(mail), newPassword: 'Brand-new-9' })
      .expect(200);

    // The reset proved the inbox; the older confirmation link is no way in any more.
    const refused = await browser
      .post('/api/v1/auth/verify-email')
      .send({ token: confirmLink })
      .expect(400);
    expect(apiErrorSchema.parse(refused.body).fields).toHaveProperty('token');

    // A link that reaches an account already confirmed is spent but opens nothing, even for
    // the browser that holds the account's session.
    const stale = await emailTokens.issue(waiting.id, 'verify_email');
    const answer = await browser
      .post('/api/v1/auth/verify-email')
      .send({ token: stale })
      .expect(200);
    expect(verifyEmailResponseSchema.parse(answer.body).user).toBeNull();
    await browser.post('/api/v1/auth/verify-email').send({ token: stale }).expect(400);
  });
});
