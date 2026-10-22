import {
  accountExportSchema,
  apiErrorSchema,
  inviteLookupSchema,
  inviteSchema,
  notificationListSchema,
} from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';
import { tokenIn, waitForEmail } from './setup/outbox.js';

const PASSWORD = 'Password123!';

describe('invites', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let aliceAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    alice = await createUser(t.prisma);
    aliceAgent = request.agent(t.server);
    await login(aliceAgent, alice.email);
  });

  const myInvite = async (agent: TestAgent) =>
    inviteSchema.parse((await agent.get('/api/v1/invites/me').expect(200)).body);

  let sequence = 0;
  /** A visitor registering through `/join/<code>`; the account waits for its confirmation. */
  async function registerWith(inviteCode: string | undefined) {
    sequence += 1;
    const email = `newcomer${sequence}-${Date.now()}@example.com`;
    const agent = request.agent(t.server);
    await agent
      .post('/api/v1/auth/register')
      .send({
        email,
        username: `newcomer_${sequence}_${Date.now() % 100000}`,
        name: 'New Comer',
        password: PASSWORD,
        inviteCode,
      })
      .expect(201);
    const user = await t.prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true, invitedById: true },
    });
    return { agent, email, ...user };
  }

  const follows = (followerId: string, followeeId: string) =>
    t.prisma.follow.count({ where: { followerId, followeeId } });

  it('gives a member one link, made on the first ask, and a new one on request', async () => {
    const first = await myInvite(aliceAgent);
    expect(first.url).toBe(`http://localhost:5173/join/${first.code}`);
    expect(await myInvite(aliceAgent)).toEqual(first);

    const renewed = inviteSchema.parse(
      (await aliceAgent.post('/api/v1/invites/me/renew').expect(200)).body,
    );
    expect(renewed.code).not.toBe(first.code);
    await request(t.server).get(`/api/v1/invites/${first.code}`).expect(404);
    await request(t.server).get(`/api/v1/invites/${renewed.code}`).expect(200);
  });

  it('tells the join page who invites, without a session; nothing for suspended members', async () => {
    const { code } = await myInvite(aliceAgent);
    const lookup = inviteLookupSchema.parse(
      (await request(t.server).get(`/api/v1/invites/${code}`).expect(200)).body,
    );
    expect(lookup.inviter).toMatchObject({ id: alice.id, username: alice.username });

    const malformed = await request(t.server).get('/api/v1/invites/x').expect(400);
    expect(apiErrorSchema.parse(malformed.body).fields).toHaveProperty('code');

    await t.prisma.user.update({ where: { id: alice.id }, data: { suspendedAt: new Date() } });
    await request(t.server).get(`/api/v1/invites/${code}`).expect(404);
  });

  it('makes the newcomer follow the inviter once the address is confirmed, told once', async () => {
    const { code } = await myInvite(aliceAgent);
    const newcomer = await registerWith(code);
    expect(newcomer.invitedById).toBe(alice.id);
    // Not before the account is open.
    expect(await follows(newcomer.id, alice.id)).toBe(0);

    const mail = await waitForEmail(newcomer.email, /Confirm/);
    await newcomer.agent
      .post('/api/v1/auth/verify-email')
      .send({ token: tokenIn(mail) })
      .expect(200);
    expect(await follows(newcomer.id, alice.id)).toBe(1);

    const notifications = notificationListSchema.parse(
      (await aliceAgent.get('/api/v1/notifications').expect(200)).body,
    );
    const fromNewcomer = notifications.items.filter((n) => n.actor?.id === newcomer.id);
    expect(fromNewcomer.map((n) => n.type)).toEqual(['INVITE_JOINED']);

    // The export says whose invite it was.
    const exported = accountExportSchema.parse(
      (await newcomer.agent.get('/api/v1/users/me/export').expect(200)).body,
    );
    expect(exported.invite.invitedBy).toEqual({ userId: alice.id, username: alice.username });
    expect(
      accountExportSchema.parse((await aliceAgent.get('/api/v1/users/me/export').expect(200)).body)
        .invite.code,
    ).toBe(code);
  });

  it('opens the account the same way when a password reset confirms the address', async () => {
    const { code } = await myInvite(aliceAgent);
    const newcomer = await registerWith(code);
    await request(t.server)
      .post('/api/v1/auth/forgot-password')
      .send({ email: newcomer.email })
      .expect(204);
    const mail = await waitForEmail(newcomer.email, /Reset your/);
    await request(t.server)
      .post('/api/v1/auth/reset-password')
      .send({ token: tokenIn(mail), newPassword: 'Brand-new-9' })
      .expect(200);
    expect(await follows(newcomer.id, alice.id)).toBe(1);
  });

  it('takes a link that no longer works as no invite, not as an error', async () => {
    const newcomer = await registerWith('no-such-code-1234');
    expect(newcomer.invitedById).toBeNull();
  });

  it('makes no follow across a block or to an inviter suspended meanwhile', async () => {
    const { code } = await myInvite(aliceAgent);
    const blocked = await registerWith(code);
    await t.prisma.block.create({ data: { blockerId: alice.id, blockedId: blocked.id } });
    await blocked.agent
      .post('/api/v1/auth/verify-email')
      .send({ token: tokenIn(await waitForEmail(blocked.email, /Confirm/)) })
      .expect(200);
    expect(await follows(blocked.id, alice.id)).toBe(0);

    const late = await registerWith(code);
    await t.prisma.user.update({ where: { id: alice.id }, data: { suspendedAt: new Date() } });
    await late.agent
      .post('/api/v1/auth/verify-email')
      .send({ token: tokenIn(await waitForEmail(late.email, /Confirm/)) })
      .expect(200);
    expect(await follows(late.id, alice.id)).toBe(0);
  });
});
