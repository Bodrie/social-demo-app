import { apiErrorSchema, authResponseSchema } from '@the-mesh/shared';
import { io } from 'socket.io-client';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import {
  TEST_PASSWORD,
  type TestAgent,
  cookiesFrom,
  createUser,
  login,
} from './setup/factories.js';
import { readOutbox, tokenIn, waitForEmail } from './setup/outbox.js';

const VERIFY_SUBJECT = /Confirm your email/;
const RESET_SUBJECT = /Reset your/;

describe('email verification and password reset', () => {
  let t: TestApp;
  let counter = 0;

  const registerMember = async () => {
    counter += 1;
    const member = {
      email: `fresh${counter}@example.com`,
      username: `fresh${counter}`,
      name: `Fresh ${counter}`,
      password: TEST_PASSWORD,
    };
    const agent: TestAgent = request.agent(t.server);
    const response = await agent.post('/api/v1/auth/register').send(member).expect(201);
    return { member, agent, user: authResponseSchema.parse(response.body).user };
  };

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('registration', () => {
    it('starts unverified, mails a link, and keeps the app closed until the link is used', async () => {
      const { member, agent, user } = await registerMember();
      expect(user.emailVerifiedAt).toBeNull();

      const mail = await waitForEmail(member.email, VERIFY_SUBJECT);
      expect(mail.text).toContain(`Hi ${member.name}`);
      expect(mail.text).toContain('http://localhost:5173/verify-email?token=');

      // The session exists, but only the verification routes answer.
      expect(
        authResponseSchema.parse((await agent.get('/api/v1/auth/me').expect(200)).body).user.id,
      ).toBe(user.id);
      const closed = await agent.get('/api/v1/posts').expect(403);
      expect(apiErrorSchema.parse(closed.body)).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Confirm your email address to continue',
      });
      await agent.post('/api/v1/posts').send({ content: 'hi' }).expect(403);

      // The socket is closed too.
      const socket = io(t.baseUrl, {
        transports: ['websocket'],
        autoConnect: false,
        reconnection: false,
        auth: {
          token: cookiesFrom(
            (
              await agent
                .post('/api/v1/auth/login')
                .send({ email: member.email, password: member.password })
                .expect(200)
            ).headers['set-cookie'],
          ).access_token,
        },
      });
      const refused = await new Promise<string>((resolve) => {
        socket.once('connect', () => resolve('connected'));
        socket.once('connect_error', (error) => resolve(error.message));
        socket.connect();
      });
      socket.disconnect();
      expect(refused).toBe('Unauthorized');

      // The link opens the account and signs the browser that used it in, even a fresh one.
      const other: TestAgent = request.agent(t.server);
      const verified = await other
        .post('/api/v1/auth/verify-email')
        .send({ token: tokenIn(mail) })
        .expect(200);
      expect(authResponseSchema.parse(verified.body).user.emailVerifiedAt).not.toBeNull();
      expect(cookiesFrom(verified.headers['set-cookie']).access_token).toBeTruthy();
      await other.get('/api/v1/posts').expect(200);

      // Single use.
      const reused = await other
        .post('/api/v1/auth/verify-email')
        .send({ token: tokenIn(mail) })
        .expect(400);
      expect(apiErrorSchema.parse(reused.body).fields).toHaveProperty('token');

      // The first browser still carries an "unverified" token until it refreshes.
      await agent.get('/api/v1/posts').expect(403);
      await agent.post('/api/v1/auth/refresh').expect(200);
      await agent.get('/api/v1/posts').expect(200);
    });

    it('mails a fresh link on request, which voids the previous one, and stops after three', async () => {
      const { member, agent } = await registerMember();
      const first = await waitForEmail(member.email, VERIFY_SUBJECT);

      await agent.post('/api/v1/auth/verify-email/resend').expect(204);
      const mails = (await readOutbox()).filter(
        (m) => m.to === member.email && VERIFY_SUBJECT.test(m.subject),
      );
      expect(mails).toHaveLength(2);
      const second = mails[1];
      if (!second) return;
      expect(tokenIn(second)).not.toBe(tokenIn(first));

      await agent
        .post('/api/v1/auth/verify-email')
        .send({ token: tokenIn(first) })
        .expect(400);
      await agent
        .post('/api/v1/auth/verify-email')
        .send({ token: tokenIn(second) })
        .expect(200);

      // Verified now: more requests are a no-op and nothing new is mailed.
      await agent.post('/api/v1/auth/verify-email/resend').expect(204);
      await agent.post('/api/v1/auth/verify-email/resend').expect(204);
      const after = (await readOutbox()).filter((m) => m.to === member.email);
      expect(after).toHaveLength(2);
      // 3 per hour from one address.
      await agent.post('/api/v1/auth/verify-email/resend').expect(429);
    });

    it('rejects garbage, expired and foreign-kind tokens the same way', async () => {
      const { member } = await registerMember();
      const mail = await waitForEmail(member.email, VERIFY_SUBJECT);
      await request(t.server).post('/api/v1/auth/verify-email').send({ token: 'nope' }).expect(400);
      await request(t.server).post('/api/v1/auth/verify-email').send({}).expect(400);
      // A verification token is not a reset token.
      await request(t.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: tokenIn(mail), newPassword: 'Another123!' })
        .expect(400);
      await t.prisma.emailToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      await request(t.server)
        .post('/api/v1/auth/verify-email')
        .send({ token: tokenIn(mail) })
        .expect(400);
    });
  });

  describe('forgot and reset password', () => {
    it('answers 204 for any address and only mails real accounts', async () => {
      await request(t.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(204);
      await request(t.server).post('/api/v1/auth/forgot-password').send({ email: 'x' }).expect(400);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect((await readOutbox()).some((m) => m.to === 'nobody@example.com')).toBe(false);
    });

    it('resets the password, ends every other session, verifies the address and signs in', async () => {
      const user = await createUser(t.prisma, { emailVerifiedAt: null });
      const oldSession: TestAgent = request.agent(t.server);
      await login(oldSession, user.email);

      await request(t.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: user.email })
        .expect(204);
      const mail = await waitForEmail(user.email, RESET_SUBJECT);
      expect(mail.text).toContain('http://localhost:5173/reset-password?token=');

      const browser: TestAgent = request.agent(t.server);
      const weak = await browser
        .post('/api/v1/auth/reset-password')
        .send({ token: tokenIn(mail), newPassword: 'short' })
        .expect(400);
      expect(apiErrorSchema.parse(weak.body).fields).toHaveProperty('newPassword');

      const done = await browser
        .post('/api/v1/auth/reset-password')
        .send({ token: tokenIn(mail), newPassword: 'Brand-new-1' })
        .expect(200);
      const me = authResponseSchema.parse(done.body).user;
      expect(me.id).toBe(user.id);
      // The link proved the address: the account opens even though it never verified before.
      expect(me.emailVerifiedAt).not.toBeNull();
      await browser.get('/api/v1/posts').expect(200);

      // Once only, old sessions are gone, and only the new password works.
      await browser
        .post('/api/v1/auth/reset-password')
        .send({ token: tokenIn(mail), newPassword: 'Brand-new-2' })
        .expect(400);
      await oldSession.post('/api/v1/auth/refresh').expect(401);
      await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(401);
      await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Brand-new-1' })
        .expect(200);
    });

    it('voids an outstanding reset link when the password is changed from inside the app', async () => {
      const user = await createUser(t.prisma);
      const agent: TestAgent = request.agent(t.server);
      await login(agent, user.email);
      await request(t.server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: user.email })
        .expect(204);
      const mail = await waitForEmail(user.email, RESET_SUBJECT);

      await agent
        .post('/api/v1/auth/password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'Changed-inside-1' })
        .expect(204);
      await request(t.server)
        .post('/api/v1/auth/reset-password')
        .send({ token: tokenIn(mail), newPassword: 'Via-link-1' })
        .expect(400);
    });
  });
});
