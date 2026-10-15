import {
  SOCKET_EVENTS,
  conversationListSchema,
  conversationReadPayloadSchema,
  markReadAckSchema,
  messageAckSchema,
  messageListSchema,
  messageSchema,
  presenceUpdateSchema,
} from '@the-mesh/shared';
import { JwtService } from '@nestjs/jwt';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import { MAX_SOCKETS_PER_USER } from '../src/chat/chat.gateway.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { TEST_PASSWORD, type CreatedUser, type TestAgent, cookiesFrom, createUser } from './setup/factories.js';

async function sessionFor(t: TestApp, user: CreatedUser): Promise<{ agent: TestAgent; token: string }> {
  const agent = request.agent(t.server);
  const response = await agent.post('/api/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD }).expect(200);
  return { agent, token: cookiesFrom(response.headers['set-cookie']).access_token ?? '' };
}

function connect(t: TestApp, options: { token?: string; cookie?: string }): Socket {
  return io(t.baseUrl, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
    auth: options.token ? { token: options.token } : {},
    extraHeaders: options.cookie ? { cookie: options.cookie } : {},
  });
}

function waitFor<T>(socket: Socket, event: string, predicate: (payload: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 5000);
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

/** Resolves with every `event` payload the socket received before `after` settled. */
async function collectUntil<T>(socket: Socket, event: string, after: Promise<unknown>): Promise<T[]> {
  const received: T[] = [];
  const handler = (payload: T) => received.push(payload);
  socket.on(event, handler);
  await after;
  socket.off(event, handler);
  return received;
}

function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
    socket.connect();
  });
}

function connectError(socket: Socket): Promise<Error> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => reject(new Error('expected the connection to be refused')));
    socket.once('connect_error', (error) => resolve(error));
    socket.connect();
  });
}

function disconnected(socket: Socket): Promise<string> {
  return new Promise((resolve) => socket.once('disconnect', (reason) => resolve(reason)));
}

const presenceIds = (payload: unknown): string[] =>
  presenceUpdateSchema
    .parse(payload)
    .map((u) => u.id)
    .toSorted();

describe('chat', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let carol: CreatedUser;
  let aliceSession: { agent: TestAgent; token: string };
  let bobSession: { agent: TestAgent; token: string };
  let carolSession: { agent: TestAgent; token: string };
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
    alice = await createUser(t.prisma);
    bob = await createUser(t.prisma);
    carol = await createUser(t.prisma);
    aliceSession = await sessionFor(t, alice);
    bobSession = await sessionFor(t, bob);
    carolSession = await sessionFor(t, carol);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('handshake', () => {
    it('refuses sockets without a valid session', async () => {
      const anonymous = connect(t, {});
      const forged = connect(t, { token: 'not-a-token' });
      sockets.push(anonymous, forged);

      expect((await connectError(anonymous)).message).toBe('Unauthorized');
      expect((await connectError(forged)).message).toBe('Unauthorized');
    });

    it('refuses expired tokens and tokens without a subject', async () => {
      const jwt = t.app.get(JwtService);
      const expired = connect(t, { token: await jwt.signAsync({ sub: alice.id }, { expiresIn: -10 }) });
      const noSubject = connect(t, { token: await jwt.signAsync({ role: 'admin' }) });
      sockets.push(expired, noSubject);

      expect((await connectError(expired)).message).toBe('Unauthorized');
      expect((await connectError(noSubject)).message).toBe('Unauthorized');
    });

    it('disconnects a socket whose user no longer exists', async () => {
      const ghost = await createUser(t.prisma);
      const { token } = await sessionFor(t, ghost);
      await t.prisma.user.delete({ where: { id: ghost.id } });
      const socket = connect(t, { token });
      sockets.push(socket);

      const gone = disconnected(socket);
      await connected(socket);
      expect(await gone).toBe('io server disconnect');
    });

    it('caps the number of sockets per user', async () => {
      const opened = Array.from({ length: MAX_SOCKETS_PER_USER }, () => connect(t, { token: carolSession.token }));
      const extra = connect(t, { token: carolSession.token });
      sockets.push(...opened, extra);
      await Promise.all(opened.map(connected));

      expect((await connectError(extra)).message).toBe('Too many connections');
    });

    it('closes a socket when its access token expires', async () => {
      const jwt = t.app.get(JwtService);
      const shortLived = connect(t, { token: await jwt.signAsync({ sub: alice.id }, { expiresIn: 1 }) });
      sockets.push(shortLived);

      const gone = disconnected(shortLived);
      await connected(shortLived);
      expect(await gone).toBe('io server disconnect');
    });
  });

  it('tracks presence per user, from the cookie or an auth token', async () => {
    const aliceSocket = connect(t, { cookie: `access_token=${aliceSession.token}` });
    const aliceTab2 = connect(t, { token: aliceSession.token });
    const bobSocket = connect(t, { token: bobSession.token });
    sockets.push(aliceSocket, aliceTab2, bobSocket);

    const first = waitFor<unknown>(aliceSocket, SOCKET_EVENTS.presenceUpdate);
    await connected(aliceSocket);
    expect(presenceIds(await first)).toEqual([alice.id]);

    // A second tab gets the current list itself; nobody else is told.
    const tabList = waitFor<unknown>(aliceTab2, SOCKET_EVENTS.presenceUpdate);
    await connected(aliceTab2);
    expect(presenceIds(await tabList)).toEqual([alice.id]);

    const withBob = waitFor<unknown>(aliceSocket, SOCKET_EVENTS.presenceUpdate, (p) => presenceIds(p).length === 2);
    const bobInitial = waitFor<unknown>(bobSocket, SOCKET_EVENTS.presenceUpdate);
    await connected(bobSocket);
    expect(presenceIds(await withBob)).toEqual([alice.id, bob.id].toSorted());
    expect(presenceIds(await bobInitial)).toEqual([alice.id, bob.id].toSorted());

    // Closing one of Alice's tabs must not report her offline: Bob sees nothing until Alice fully leaves.
    const afterAliceLeft = waitFor<unknown>(bobSocket, SOCKET_EVENTS.presenceUpdate);
    aliceTab2.disconnect();
    aliceSocket.disconnect();
    expect(presenceIds(await afterAliceLeft)).toEqual([bob.id]);
  });

  it('delivers persisted messages to both parties only, with history, conversations and read receipts', async () => {
    const aliceSocket = connect(t, { token: aliceSession.token });
    const aliceTab2 = connect(t, { token: aliceSession.token });
    const bobSocket = connect(t, { token: bobSession.token });
    const carolSocket = connect(t, { token: carolSession.token });
    sockets.push(aliceSocket, aliceTab2, bobSocket, carolSocket);
    await Promise.all([connected(aliceSocket), connected(aliceTab2), connected(bobSocket), connected(carolSocket)]);

    const bobReceives = waitFor<unknown>(bobSocket, SOCKET_EVENTS.messageNew);
    const aliceTabReceives = waitFor<unknown>(aliceTab2, SOCKET_EVENTS.messageNew);
    const carolSaw = collectUntil<unknown>(carolSocket, SOCKET_EVENTS.messageNew, Promise.all([bobReceives, aliceTabReceives]));
    const ack = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, { recipientId: bob.id, content: '  hello bob  ' }),
    );
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.message).toMatchObject({ senderId: alice.id, recipientId: bob.id, content: 'hello bob', readAt: null });
    expect(messageSchema.parse(await bobReceives).id).toBe(ack.message.id);
    expect(messageSchema.parse(await aliceTabReceives).id).toBe(ack.message.id);
    expect(await carolSaw).toEqual([]);

    // HTTP sending reaches open sockets the same way.
    const bobReceivesHttp = waitFor<unknown>(bobSocket, SOCKET_EVENTS.messageNew);
    const viaHttp = messageSchema.parse((await aliceSession.agent.post(`/api/v1/messages/${bob.id}`).send({ content: 'and via http' }).expect(201)).body);
    expect(messageSchema.parse(await bobReceivesHttp).id).toBe(viaHttp.id);

    const history = messageListSchema.parse((await bobSession.agent.get(`/api/v1/messages/${alice.id}`).expect(200)).body);
    expect(history.items.map((m) => m.content)).toEqual(['and via http', 'hello bob']);

    const bobConversations = conversationListSchema.parse((await bobSession.agent.get('/api/v1/messages').expect(200)).body);
    expect(bobConversations.items).toHaveLength(1);
    expect(bobConversations.items[0]).toMatchObject({ peer: { id: alice.id }, lastMessage: { id: viaHttp.id }, unreadCount: 2 });

    // The sender cannot mark their own messages read for the recipient.
    expect((await aliceSession.agent.post(`/api/v1/messages/${bob.id}/read`).expect(200)).body).toEqual({ count: 0 });

    const aliceNotified = waitFor<unknown>(aliceSocket, SOCKET_EVENTS.conversationRead);
    const carolSawRead = collectUntil<unknown>(carolSocket, SOCKET_EVENTS.conversationRead, aliceNotified);
    const readAck = markReadAckSchema.parse(await bobSocket.emitWithAck(SOCKET_EVENTS.messageRead, { userId: alice.id }));
    expect(readAck).toEqual({ ok: true, count: 2 });
    expect(conversationReadPayloadSchema.parse(await aliceNotified).userId).toBe(bob.id);
    expect(await carolSawRead).toEqual([]);

    const aliceConversations = conversationListSchema.parse((await aliceSession.agent.get('/api/v1/messages').expect(200)).body);
    expect(aliceConversations.items[0]).toMatchObject({ peer: { id: bob.id }, unreadCount: 0 });
    expect(aliceConversations.items[0]?.lastMessage.readAt).not.toBeNull();
  });

  it('validates socket payloads and reports errors in the ack', async () => {
    const aliceSocket = connect(t, { token: aliceSession.token });
    sockets.push(aliceSocket);
    await connected(aliceSocket);

    const empty = messageAckSchema.parse(await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, { recipientId: bob.id, content: '  ' }));
    expect(empty).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR', fields: { content: expect.any(String) } } });

    const self = messageAckSchema.parse(await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, { recipientId: alice.id, content: 'me' }));
    expect(self).toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });

    const ghost = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, { recipientId: '00000000-0000-7000-8000-000000000000', content: 'hi' }),
    );
    expect(ghost).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const badRead = markReadAckSchema.parse(await aliceSocket.emitWithAck(SOCKET_EVENTS.messageRead, { userId: 'nope' }));
    expect(badRead).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR', fields: { userId: expect.any(String) } } });
  });

  it('rate limits socket sends per user', async () => {
    const spammer = await createUser(t.prisma);
    const { token } = await sessionFor(t, spammer);
    const socket = connect(t, { token });
    sockets.push(socket);
    await connected(socket);

    const results = [];
    for (let i = 0; i < 61; i += 1) {
      // oxlint-disable-next-line no-await-in-loop -- sequential on purpose: the window counts calls
      results.push(messageAckSchema.parse(await socket.emitWithAck(SOCKET_EVENTS.messageSend, { recipientId: bob.id, content: `m${i}` })));
    }
    expect(results.slice(0, 60).every((r) => r.ok)).toBe(true);
    expect(results[60]).toMatchObject({ ok: false, error: { code: 'TOO_MANY_REQUESTS' } });
  });

  it('cuts every open socket when all sessions are revoked', async () => {
    const victim = await createUser(t.prisma);
    const session = await sessionFor(t, victim);
    const socket = connect(t, { token: session.token });
    sockets.push(socket);
    await connected(socket);

    const gone = disconnected(socket);
    await session.agent.post('/api/v1/auth/logout-all').expect(204);
    expect(await gone).toBe('io server disconnect');
  });

  it('requires a session on the HTTP endpoints', async () => {
    await request(t.server).get('/api/v1/messages').expect(401);
    await request(t.server).post(`/api/v1/messages/${bob.id}`).send({ content: 'x' }).expect(401);
  });
});
