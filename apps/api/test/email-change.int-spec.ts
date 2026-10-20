import { randomUUID } from 'node:crypto';
import { apiErrorSchema, meResponseSchema, sessionListSchema } from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import {
  TEST_PASSWORD,
  type CreatedUser,
  type TestAgent,
  createUser,
  login,
} from './setup/factories.js';
import { readOutbox, tokenIn, waitForEmail, waitForEmails } from './setup/outbox.js';

const CONFIRM_SUBJECT = /Confirm your new email/;
const NOTICE_SUBJECT = /asked to change the email/;
const CHANGED_SUBJECT = /email address of your .* was changed/;

const me = async (agent: TestAgent) =>
  meResponseSchema.parse((await agent.get('/api/v1/auth/me').expect(200)).body).user;

// Each describe boots its own app: POST /auth/email allows five a minute per address.
describe('email change (ADR 0010 amendment)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('moves the account to a new address through a link mailed there, telling the old one', async () => {
    const user = await createUser(t.prisma);
    const other = await createUser(t.prisma);
    const agent = request.agent(t.server);
    await login(agent, user.email);
    const newEmail = `new-${randomUUID().slice(0, 8)}@example.com`;

    const taken = await agent
      .post('/api/v1/auth/email')
      .send({ newEmail: other.email, password: TEST_PASSWORD })
      .expect(409);
    expect(apiErrorSchema.parse(taken.body).fields).toHaveProperty('newEmail');
    const wrong = await agent
      .post('/api/v1/auth/email')
      .send({ newEmail, password: 'not-it' })
      .expect(400);
    expect(apiErrorSchema.parse(wrong.body).fields).toHaveProperty('password');
    const same = await agent
      .post('/api/v1/auth/email')
      .send({ newEmail: user.email, password: TEST_PASSWORD })
      .expect(400);
    expect(apiErrorSchema.parse(same.body).fields).toHaveProperty('newEmail');

    const asked = await agent
      .post('/api/v1/auth/email')
      .send({ newEmail, password: TEST_PASSWORD })
      .expect(200);
    expect(meResponseSchema.parse(asked.body).user).toMatchObject({
      email: user.email,
      pendingEmail: newEmail,
    });
    const mail = await waitForEmail(newEmail, CONFIRM_SUBJECT);
    expect(mail.text).toContain('http://localhost:5173/confirm-email?token=');
    expect((await waitForEmail(user.email, NOTICE_SUBJECT)).text).toContain(newEmail);

    await agent.post('/api/v1/auth/email/resend').expect(204);
    expect(await waitForEmails(newEmail, CONFIRM_SUBJECT, 2)).toHaveLength(2);
    const latest = (await waitForEmails(newEmail, CONFIRM_SUBJECT, 2)).at(-1);
    if (!latest) throw new Error('no mail');

    // The link works from anywhere and signs nobody in; the old link was replaced.
    await request(t.server)
      .post('/api/v1/auth/email/confirm')
      .send({ token: tokenIn(mail) })
      .expect(400);
    const done = await request(t.server)
      .post('/api/v1/auth/email/confirm')
      .send({ token: tokenIn(latest) })
      .expect(200);
    expect(done.body).toEqual({ email: newEmail });
    expect(done.headers['set-cookie']).toBeUndefined();
    expect(await me(agent)).toMatchObject({ email: newEmail, pendingEmail: null });
    expect((await waitForEmail(user.email, CHANGED_SUBJECT)).text).toContain(newEmail);
    await request(t.server)
      .post('/api/v1/auth/email/confirm')
      .send({ token: tokenIn(latest) })
      .expect(400);

    await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(401);
    await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email: newEmail, password: TEST_PASSWORD })
      .expect(200);
  });

  it('opens a waiting account through the new address, from the waiting room', async () => {
    const waiting = await createUser(t.prisma, { emailVerifiedAt: null });
    const agent = request.agent(t.server);
    await login(agent, waiting.email);
    await agent.get('/api/v1/posts').expect(403);
    const newEmail = `right-${randomUUID().slice(0, 8)}@example.com`;
    await agent.post('/api/v1/auth/email').send({ newEmail, password: TEST_PASSWORD }).expect(200);
    const mail = await waitForEmail(newEmail, CONFIRM_SUBJECT);
    await request(t.server)
      .post('/api/v1/auth/email/confirm')
      .send({ token: tokenIn(mail) })
      .expect(200);
    // Confirmed through the new address: the account is open after a refresh.
    await agent.post('/api/v1/auth/refresh').expect(200);
    expect((await me(agent)).emailVerifiedAt).not.toBeNull();
    await agent.get('/api/v1/posts').expect(200);
  });
});

describe('a pending change that is cancelled or overtaken', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('is dropped, and its link no longer works', async () => {
    const user = await createUser(t.prisma);
    const agent = request.agent(t.server);
    await login(agent, user.email);

    const first = `first-${randomUUID().slice(0, 8)}@example.com`;
    await agent
      .post('/api/v1/auth/email')
      .send({ newEmail: first, password: TEST_PASSWORD })
      .expect(200);
    const firstMail = await waitForEmail(first, CONFIRM_SUBJECT);
    const cancelled = await agent.delete('/api/v1/auth/email').expect(200);
    expect(meResponseSchema.parse(cancelled.body).user.pendingEmail).toBeNull();
    await request(t.server)
      .post('/api/v1/auth/email/confirm')
      .send({ token: tokenIn(firstMail) })
      .expect(400);
    await agent.post('/api/v1/auth/email/resend').expect(400);

    // Taken by someone else between the request and the link: the change is dropped.
    const second = `second-${randomUUID().slice(0, 8)}@example.com`;
    await agent
      .post('/api/v1/auth/email')
      .send({ newEmail: second, password: TEST_PASSWORD })
      .expect(200);
    const secondMail = await waitForEmail(second, CONFIRM_SUBJECT);
    await createUser(t.prisma, { email: second });
    await request(t.server)
      .post('/api/v1/auth/email/confirm')
      .send({ token: tokenIn(secondMail) })
      .expect(409);
    expect((await me(agent)).pendingEmail).toBeNull();
    const changed = (await readOutbox()).filter(
      (m) => m.to === user.email && CHANGED_SUBJECT.test(m.subject),
    );
    expect(changed).toEqual([]);
  });
});

describe('sessions (ADR 0010 amendment)', () => {
  let t: TestApp;
  let user: CreatedUser;

  beforeAll(async () => {
    t = await createTestApp();
    user = await createUser(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('lists the signed-in devices, marks this one, keeps a session across rotation and ends one', async () => {
    const windows = request.agent(t.server);
    await windows
      .post('/api/v1/auth/login')
      .set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      )
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);
    const linux = request.agent(t.server);
    await linux
      .post('/api/v1/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    const seen = sessionListSchema.parse(
      (await windows.get('/api/v1/auth/sessions').expect(200)).body,
    );
    expect(seen.items.map((s) => [s.browser, s.os, s.current])).toEqual([
      ['Firefox', 'Linux', false],
      ['Chrome', 'Windows', true],
    ]);
    expect(seen.items[0]?.ip).toMatch(/\.x$/);
    const mine = seen.items[1];
    const theirs = seen.items[0];
    if (!mine || !theirs) throw new Error('two sessions expected');

    // A rotated token is the same session: same start, a newer "last active".
    await windows.post('/api/v1/auth/refresh').expect(200);
    const after = sessionListSchema.parse(
      (await windows.get('/api/v1/auth/sessions').expect(200)).body,
    );
    expect(after.items).toHaveLength(2);
    const rotated = after.items.find((s) => s.current);
    if (!rotated) throw new Error('this session expected');
    expect(rotated.createdAt).toBe(mine.createdAt);
    expect(rotated.lastUsedAt >= mine.lastUsedAt).toBe(true);

    await windows.delete(`/api/v1/auth/sessions/${theirs.id}`).expect(204);
    await windows.delete(`/api/v1/auth/sessions/${theirs.id}`).expect(404);
    await linux.post('/api/v1/auth/refresh').expect(401);
    const left = sessionListSchema.parse(
      (await windows.get('/api/v1/auth/sessions').expect(200)).body,
    );
    expect(left.items.map((s) => s.current)).toEqual([true]);
  });
});
