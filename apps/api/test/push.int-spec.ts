import {
  type PushPayload,
  apiErrorSchema,
  conversationSchema,
  postSchema,
  pushConfigSchema,
  pushPayloadSchema,
  sessionListSchema,
} from '@beso/shared';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  PUSH_SENDER,
  type PushOptions,
  type PushSender,
  type PushTarget,
} from '../src/push/push.sender.js';
import { PushService } from '../src/push/push.service.js';
import { type TestApp, createTestApp } from './setup/app.js';
import {
  TEST_PASSWORD,
  type CreatedUser,
  type TestAgent,
  cookiesFrom,
  createUser,
} from './setup/factories.js';

// Push is on only with the VAPID keys, read when the app module loads (ADR 0022). The fake
// sender below never uses them, so any well-formed values do.
const VAPID_PUBLIC_KEY = vi.hoisted(() => {
  const key = `B${'A'.repeat(86)}`;
  process.env.VAPID_PUBLIC_KEY = key;
  process.env.VAPID_PRIVATE_KEY = 'a'.repeat(43);
  process.env.VAPID_SUBJECT = 'mailto:push@example.com';
  return key;
});

type Sent = { endpoint: string; payload: PushPayload; options: PushOptions };

const KEYS = { p256dh: `B${'q'.repeat(86)}`, auth: 'a'.repeat(22) };
const endpoint = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;

describe('web push', () => {
  let t: TestApp;
  const sent: Sent[] = [];
  const gone = new Set<string>();
  const fakeSender: PushSender = {
    send: (target: PushTarget, payload: string, options: PushOptions) => {
      sent.push({
        endpoint: target.endpoint,
        payload: pushPayloadSchema.parse(JSON.parse(payload)),
        options,
      });
      return Promise.resolve(gone.has(target.endpoint) ? 'gone' : 'sent');
    },
  };

  beforeAll(async () => {
    t = await createTestApp({
      overrides: (builder) => builder.overrideProvider(PUSH_SENDER).useValue(fakeSender),
    });
  });

  afterAll(async () => {
    await t.app.close();
    for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) {
      delete process.env[key];
    }
  });

  beforeEach(() => {
    sent.length = 0;
    gone.clear();
  });

  async function signIn(user: CreatedUser): Promise<{ agent: TestAgent; accessToken: string }> {
    const agent = request.agent(t.server);
    const response = await agent
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);
    return {
      agent,
      accessToken: cookiesFrom(response.headers['set-cookie']).access_token ?? '',
    };
  }

  const subscribe = (agent: TestAgent, name: string) =>
    agent
      .put('/api/v1/push/subscriptions')
      .send({ endpoint: endpoint(name), keys: KEYS })
      .expect(204);

  const devicesOf = (userId: string) =>
    t.prisma.pushSubscription
      .findMany({ where: { userId }, select: { endpoint: true } })
      .then((rows) => rows.map((row) => row.endpoint).sort());

  /** Pushes leave the request path, so they are waited for. */
  const pushesTo = async (name: string, count = 1) => {
    await vi.waitFor(() =>
      expect(sent.filter((push) => push.endpoint === endpoint(name)).length).toBe(count),
    );
    return sent.filter((push) => push.endpoint === endpoint(name));
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

  it('hands out the public key', async () => {
    const { agent } = await signIn(await createUser(t.prisma));
    const config = pushConfigSchema.parse(
      (await agent.get('/api/v1/push/config').expect(200)).body,
    );
    expect(config.publicKey).toBe(VAPID_PUBLIC_KEY);
  });

  it('ties a subscription to the sign-in and refuses addresses that are not push services', async () => {
    const alice = await createUser(t.prisma);
    const { agent, accessToken } = await signIn(alice);
    await subscribe(agent, 'tie-1');

    const [row] = await t.prisma.pushSubscription.findMany({ where: { userId: alice.id } });
    const [session] = await t.prisma.refreshToken.findMany({ where: { userId: alice.id } });
    expect(row?.signInId).toBe(session?.signInId);
    const sid = (
      JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString()) as {
        sid?: string;
      }
    ).sid;
    expect(sid).toBe(session?.signInId);

    // The sign-in survives the refresh rotation.
    const refreshed = await agent.post('/api/v1/auth/refresh').expect(200);
    const newToken = cookiesFrom(refreshed.headers['set-cookie']).access_token ?? '';
    const newSid = (
      JSON.parse(Buffer.from(newToken.split('.')[1] ?? '', 'base64url').toString()) as {
        sid?: string;
      }
    ).sid;
    expect(newSid).toBe(sid);

    const refused = await agent
      .put('/api/v1/push/subscriptions')
      .send({ endpoint: 'https://169.254.169.254/latest', keys: KEYS })
      .expect(400);
    expect(apiErrorSchema.parse(refused.body).fields).toHaveProperty('endpoint');

    // A token from before sign-ins had ids: 401, which the web client answers with a refresh.
    const old = await t.app.get(JwtService).signAsync({ sub: alice.id, ev: true });
    await request(t.server)
      .put('/api/v1/push/subscriptions')
      .set('Authorization', `Bearer ${old}`)
      .send({ endpoint: endpoint('tie-2'), keys: KEYS })
      .expect(401);
  });

  it('pushes notifications in the web’s words, unless the member switched them off', async () => {
    const [alice, bob] = [await createUser(t.prisma), await createUser(t.prisma)];
    const aliceSession = await signIn(alice);
    const bobSession = await signIn(bob);
    await subscribe(aliceSession.agent, 'social-alice');
    await subscribe(bobSession.agent, 'social-bob');
    const post = postSchema.parse(
      (await aliceSession.agent.post('/api/v1/posts').send({ content: 'Sunny day' }).expect(201))
        .body,
    );

    await bobSession.agent.put(`/api/v1/posts/${post.id}/like`).expect(204);
    const [push] = await pushesTo('social-alice');
    expect(push?.payload).toMatchObject({
      title: bob.name,
      body: 'Liked your post: “Sunny day”',
      url: `/p/${post.id}`,
    });
    expect(push?.options).toMatchObject({ urgency: 'normal' });
    // The actor's own devices hear nothing of it.
    await settle();
    expect(sent.some((p) => p.endpoint === endpoint('social-bob'))).toBe(false);

    await aliceSession.agent
      .patch('/api/v1/users/me/settings')
      .send({ pushSocial: false })
      .expect(200);
    await bobSession.agent.delete(`/api/v1/posts/${post.id}/like`).expect(204);
    await bobSession.agent.put(`/api/v1/users/${alice.id}/follow`).expect(204);
    await settle();
    expect(sent.filter((p) => p.endpoint === endpoint('social-alice'))).toHaveLength(1);
  });

  it('pushes messages to the other members, with or without the words, never system lines', async () => {
    const [alice, bob] = [await createUser(t.prisma), await createUser(t.prisma)];
    const aliceSession = await signIn(alice);
    const bobSession = await signIn(bob);
    await subscribe(aliceSession.agent, 'chat-alice');
    await subscribe(bobSession.agent, 'chat-bob');
    const direct = conversationSchema.parse(
      (await bobSession.agent.put(`/api/v1/conversations/direct/${alice.id}`).expect(200)).body,
    );
    const say = (content: string) =>
      bobSession.agent
        .post(`/api/v1/conversations/${direct.id}/messages`)
        .send({ content })
        .expect(201);

    await say('Lunch at one?');
    const [push] = await pushesTo('chat-alice');
    expect(push?.payload).toMatchObject({
      title: bob.name,
      body: 'Lunch at one?',
      url: `/messages/${direct.id}`,
      tag: direct.id,
    });
    expect(push?.options).toMatchObject({
      urgency: 'high',
      topic: direct.id.replaceAll('-', ''),
    });

    await aliceSession.agent
      .patch('/api/v1/users/me/settings')
      .send({ pushPreviews: false })
      .expect(200);
    await say('Secret plans');
    const pushes = await pushesTo('chat-alice', 2);
    expect(pushes[1]?.payload.body).toBe('New message');

    await aliceSession.agent
      .patch('/api/v1/users/me/settings')
      .send({ pushMessages: false })
      .expect(200);
    await say('Anyone?');
    // A group's system line ("bob created the group") is nobody's message either.
    await bobSession.agent
      .post('/api/v1/conversations')
      .send({ title: 'Trip', memberIds: [alice.id] })
      .expect(201);
    await settle();
    expect(sent.filter((p) => p.endpoint === endpoint('chat-alice'))).toHaveLength(2);
    expect(sent.some((p) => p.endpoint === endpoint('chat-bob'))).toBe(false);
  });

  it('forgets a device the push service no longer knows', async () => {
    const [alice, bob] = [await createUser(t.prisma), await createUser(t.prisma)];
    const aliceSession = await signIn(alice);
    const bobSession = await signIn(bob);
    await subscribe(aliceSession.agent, 'gone-alice');
    gone.add(endpoint('gone-alice'));

    await bobSession.agent.put(`/api/v1/users/${alice.id}/follow`).expect(204);
    await pushesTo('gone-alice');
    await vi.waitFor(async () => expect(await devicesOf(alice.id)).toEqual([]));
  });

  it('stops pushing to a device the moment its session ends, and only to that one', async () => {
    const alice = await createUser(t.prisma);
    const phone = await signIn(alice);
    const laptop = await signIn(alice);
    const tablet = await signIn(alice);
    await subscribe(phone.agent, 'end-phone');
    await subscribe(laptop.agent, 'end-laptop');
    await subscribe(tablet.agent, 'end-tablet');
    expect(await devicesOf(alice.id)).toHaveLength(3);

    // Signing out on the tablet takes its device along, nothing else.
    await tablet.agent.post('/api/v1/auth/logout').expect(204);
    expect(await devicesOf(alice.id)).toEqual([endpoint('end-laptop'), endpoint('end-phone')]);

    // "Sign out" on the laptop from the phone's sessions list.
    const sessions = sessionListSchema.parse(
      (await phone.agent.get('/api/v1/auth/sessions').expect(200)).body,
    );
    const laptopSession = sessions.items.find((session) => !session.current);
    await phone.agent.delete(`/api/v1/auth/sessions/${laptopSession?.id}`).expect(204);
    expect(await devicesOf(alice.id)).toEqual([endpoint('end-phone')]);

    // A password change keeps the device that made it.
    const other = await signIn(alice);
    await subscribe(other.agent, 'end-other');
    await phone.agent
      .post('/api/v1/auth/password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'An0ther-Password!' })
      .expect(204);
    expect(await devicesOf(alice.id)).toEqual([endpoint('end-phone')]);

    // Sign out everywhere: nothing left.
    await phone.agent.post('/api/v1/auth/logout-all').expect(204);
    expect(await devicesOf(alice.id)).toEqual([]);
  });

  it('lets the daily job forget devices whose sign-in expired', async () => {
    const alice = await createUser(t.prisma);
    const { agent } = await signIn(alice);
    await subscribe(agent, 'expire-alice');
    await t.prisma.refreshToken.updateMany({
      where: { userId: alice.id },
      data: { expiresAt: new Date('2026-01-01T00:00:00.000Z') },
    });

    const removed = await t.app.get(PushService).pruneEnded(new Date());
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await devicesOf(alice.id)).toEqual([]);
  });
});
