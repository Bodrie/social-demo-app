import {
  SOCKET_EVENTS,
  apiErrorSchema,
  conversationListSchema,
  conversationReadPayloadSchema,
  conversationSchema,
  markReadAckSchema,
  markReadResultSchema,
  messageAckSchema,
  messageListSchema,
  messageSchema,
  presenceUpdateSchema,
  typingUpdateSchema,
  uploadResponseSchema,
} from '@the-mesh/shared';
import { JwtService } from '@nestjs/jwt';
import sharp from 'sharp';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import { MAX_SOCKETS_PER_USER } from '../src/chat/chat.gateway.js';
import { type TestApp, createTestApp } from './setup/app.js';
import {
  TEST_PASSWORD,
  type CreatedUser,
  type TestAgent,
  cookiesFrom,
  createUser,
} from './setup/factories.js';

async function sessionFor(
  t: TestApp,
  user: CreatedUser,
): Promise<{ agent: TestAgent; token: string }> {
  const agent = request.agent(t.server);
  const response = await agent
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD })
    .expect(200);
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

function waitFor<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
): Promise<T> {
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
async function collectUntil<T>(
  socket: Socket,
  event: string,
  after: Promise<unknown>,
): Promise<T[]> {
  const received: T[] = [];
  const handler = (payload: T) => received.push(payload);
  socket.on(event, handler);
  await after;
  socket.off(event, handler);
  return received;
}

/** Polls until `predicate` holds or `timeoutMs` passed (the assertion afterwards tells which). */
async function until(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop -- polling on purpose
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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

function png(): Promise<Buffer> {
  return sharp({ create: { width: 320, height: 200, channels: 3, background: '#3366aa' } })
    .png()
    .toBuffer();
}

async function uploadPicture(agent: TestAgent, kind: string) {
  const response = await agent
    .post(`/api/v1/uploads?kind=${kind}`)
    .attach('file', await png(), 'pic.png')
    .expect(201);
  return uploadResponseSchema.parse(response.body);
}

/** The direct conversation between the agent's user and `userId` (idempotent). */
async function directWith(agent: TestAgent, userId: string) {
  const response = await agent.put(`/api/v1/conversations/direct/${userId}`).expect(200);
  return conversationSchema.parse(response.body);
}

async function listFor(agent: TestAgent) {
  return conversationListSchema.parse((await agent.get('/api/v1/conversations').expect(200)).body);
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
      const expired = connect(t, {
        token: await jwt.signAsync({ sub: alice.id }, { expiresIn: -10 }),
      });
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
      const opened = Array.from({ length: MAX_SOCKETS_PER_USER }, () =>
        connect(t, { token: carolSession.token }),
      );
      const extra = connect(t, { token: carolSession.token });
      sockets.push(...opened, extra);
      await Promise.all(opened.map(connected));

      expect((await connectError(extra)).message).toBe('Too many connections');
    });

    it('closes a socket when its access token expires', async () => {
      const jwt = t.app.get(JwtService);
      const shortLived = connect(t, {
        token: await jwt.signAsync({ sub: alice.id }, { expiresIn: 1 }),
      });
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

    const withBob = waitFor<unknown>(
      aliceSocket,
      SOCKET_EVENTS.presenceUpdate,
      (p) => presenceIds(p).length === 2,
    );
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

  it('delivers persisted messages to every member only, with history, the list and read receipts', async () => {
    const aliceSocket = connect(t, { token: aliceSession.token });
    const aliceTab2 = connect(t, { token: aliceSession.token });
    const bobSocket = connect(t, { token: bobSession.token });
    const carolSocket = connect(t, { token: carolSession.token });
    sockets.push(aliceSocket, aliceTab2, bobSocket, carolSocket);
    await Promise.all([
      connected(aliceSocket),
      connected(aliceTab2),
      connected(bobSocket),
      connected(carolSocket),
    ]);

    const direct = await directWith(aliceSession.agent, bob.id);
    expect(direct).toMatchObject({
      kind: 'direct',
      title: null,
      lastMessage: null,
      unreadCount: 0,
    });
    expect(direct.members.map((m) => m.user.id).toSorted()).toEqual([alice.id, bob.id].toSorted());
    // Nothing said yet: the thread is not listed.
    expect((await listFor(bobSession.agent)).items).toEqual([]);

    const bobReceives = waitFor<unknown>(bobSocket, SOCKET_EVENTS.messageNew);
    const aliceTabReceives = waitFor<unknown>(aliceTab2, SOCKET_EVENTS.messageNew);
    const carolSaw = collectUntil<unknown>(
      carolSocket,
      SOCKET_EVENTS.messageNew,
      Promise.all([bobReceives, aliceTabReceives]),
    );
    const ack = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, {
        conversationId: direct.id,
        content: '  hello bob  ',
      }),
    );
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.message).toMatchObject({
      conversationId: direct.id,
      senderId: alice.id,
      content: 'hello bob',
    });
    expect(messageSchema.parse(await bobReceives).id).toBe(ack.message.id);
    expect(messageSchema.parse(await aliceTabReceives).id).toBe(ack.message.id);
    expect(await carolSaw).toEqual([]);

    // HTTP sending reaches open sockets the same way.
    const bobReceivesHttp = waitFor<unknown>(bobSocket, SOCKET_EVENTS.messageNew);
    const viaHttp = messageSchema.parse(
      (
        await aliceSession.agent
          .post(`/api/v1/conversations/${direct.id}/messages`)
          .send({ content: 'and via http' })
          .expect(201)
      ).body,
    );
    expect(messageSchema.parse(await bobReceivesHttp).id).toBe(viaHttp.id);

    const history = messageListSchema.parse(
      (await bobSession.agent.get(`/api/v1/conversations/${direct.id}/messages`).expect(200)).body,
    );
    expect(history.items.map((m) => m.content)).toEqual(['and via http', 'hello bob']);

    const bobList = await listFor(bobSession.agent);
    expect(bobList.items).toHaveLength(1);
    expect(bobList.items[0]).toMatchObject({
      id: direct.id,
      lastMessage: { id: viaHttp.id },
      unreadCount: 2,
    });
    // Writing counts as reading: the sender has nothing unread and a read call changes nothing.
    expect((await listFor(aliceSession.agent)).items[0]?.unreadCount).toBe(0);
    const aliceRead = markReadResultSchema.parse(
      (await aliceSession.agent.post(`/api/v1/conversations/${direct.id}/read`).expect(200)).body,
    );
    expect(aliceRead.readAt).toBe(viaHttp.createdAt);

    const aliceNotified = waitFor<unknown>(aliceSocket, SOCKET_EVENTS.conversationRead);
    const carolSawRead = collectUntil<unknown>(
      carolSocket,
      SOCKET_EVENTS.conversationRead,
      aliceNotified,
    );
    const readAck = markReadAckSchema.parse(
      await bobSocket.emitWithAck(SOCKET_EVENTS.messageRead, { conversationId: direct.id }),
    );
    expect(readAck.ok).toBe(true);
    expect(conversationReadPayloadSchema.parse(await aliceNotified)).toMatchObject({
      conversationId: direct.id,
      userId: bob.id,
    });
    expect(await carolSawRead).toEqual([]);

    const bobAsSeenByAlice = (await listFor(aliceSession.agent)).items[0]?.members.find(
      (member) => member.user.id === bob.id,
    );
    expect(bobAsSeenByAlice?.lastReadAt).not.toBeNull();
    expect(bobAsSeenByAlice?.lastReadAt ?? '').toBe(readAck.ok ? readAck.readAt : '');
    expect((await listFor(bobSession.agent)).items[0]?.unreadCount).toBe(0);
  });

  it('validates socket payloads and reports errors in the ack', async () => {
    const aliceSocket = connect(t, { token: aliceSession.token });
    const carolSocket = connect(t, { token: carolSession.token });
    sockets.push(aliceSocket, carolSocket);
    await Promise.all([connected(aliceSocket), connected(carolSocket)]);
    const direct = await directWith(aliceSession.agent, bob.id);

    const empty = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, {
        conversationId: direct.id,
        content: '  ',
      }),
    );
    expect(empty).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fields: { content: expect.any(String) } },
    });

    const ghost = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, {
        conversationId: '00000000-0000-7000-8000-000000000000',
        content: 'hi',
      }),
    );
    expect(ghost).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    // Not a member: the conversation does not exist as far as Carol is concerned.
    const outsider = messageAckSchema.parse(
      await carolSocket.emitWithAck(SOCKET_EVENTS.messageSend, {
        conversationId: direct.id,
        content: 'let me in',
      }),
    );
    expect(outsider).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const outsiderRead = markReadAckSchema.parse(
      await carolSocket.emitWithAck(SOCKET_EVENTS.messageRead, { conversationId: direct.id }),
    );
    expect(outsiderRead).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const badRead = markReadAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageRead, { conversationId: 'nope' }),
    );
    expect(badRead).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fields: { conversationId: expect.any(String) } },
    });
  });

  it('sends pictures: an owned upload of kind "message", text optional', async () => {
    const aliceSocket = connect(t, { token: aliceSession.token });
    const bobSocket = connect(t, { token: bobSession.token });
    sockets.push(aliceSocket, bobSocket);
    await Promise.all([connected(aliceSocket), connected(bobSocket)]);
    const direct = await directWith(aliceSession.agent, bob.id);

    const picture = await uploadPicture(aliceSession.agent, 'message');
    expect(picture.key).toMatch(/^message\//);
    expect(picture.width).toBe(320);

    const bobReceives = waitFor<unknown>(bobSocket, SOCKET_EVENTS.messageNew);
    const ack = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, {
        conversationId: direct.id,
        imageKey: picture.key,
      }),
    );
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.message).toMatchObject({ content: '', imageUrl: picture.url });
    expect(messageSchema.parse(await bobReceives).imageUrl).toBe(picture.url);

    // Text and picture together over HTTP; the picture shows up in history and the list.
    const both = await uploadPicture(aliceSession.agent, 'message');
    const viaHttp = messageSchema.parse(
      (
        await aliceSession.agent
          .post(`/api/v1/conversations/${direct.id}/messages`)
          .send({ content: ' look ', imageKey: both.key })
          .expect(201)
      ).body,
    );
    expect(viaHttp).toMatchObject({ content: 'look', imageUrl: both.url });
    const history = messageListSchema.parse(
      (await bobSession.agent.get(`/api/v1/conversations/${direct.id}/messages`).expect(200)).body,
    );
    expect(history.items[0]).toMatchObject({ id: viaHttp.id, imageUrl: both.url });
    expect((await listFor(bobSession.agent)).items[0]?.lastMessage).toMatchObject({
      id: viaHttp.id,
      imageUrl: both.url,
    });

    // Neither text nor picture.
    const nothing = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, { conversationId: direct.id }),
    );
    expect(nothing).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fields: { content: expect.any(String) } },
    });

    // Uploads of another kind, and other people's uploads, are refused on the key.
    const postPicture = await uploadPicture(aliceSession.agent, 'post');
    const wrongKind = await aliceSession.agent
      .post(`/api/v1/conversations/${direct.id}/messages`)
      .send({ imageKey: postPicture.key })
      .expect(400);
    expect(apiErrorSchema.parse(wrongKind.body).fields).toHaveProperty('imageKey');
    const bobsPicture = await uploadPicture(bobSession.agent, 'message');
    const notMine = await aliceSession.agent
      .post(`/api/v1/conversations/${direct.id}/messages`)
      .send({ imageKey: bobsPicture.key })
      .expect(400);
    expect(apiErrorSchema.parse(notMine.body).fields).toEqual({ imageKey: 'Unknown upload' });
  });

  it('relays typing to the other members only and drops bad or foreign signals', async () => {
    const aliceSocket = connect(t, { token: aliceSession.token });
    const aliceTab2 = connect(t, { token: aliceSession.token });
    const bobSocket = connect(t, { token: bobSession.token });
    const carolSocket = connect(t, { token: carolSession.token });
    sockets.push(aliceSocket, aliceTab2, bobSocket, carolSocket);
    await Promise.all([
      connected(aliceSocket),
      connected(aliceTab2),
      connected(bobSocket),
      connected(carolSocket),
    ]);
    const direct = await directWith(aliceSession.agent, bob.id);

    const bobStopped = waitFor<unknown>(
      bobSocket,
      SOCKET_EVENTS.typingUpdate,
      (payload) => !typingUpdateSchema.parse(payload).typing,
    );
    const bobSaw = collectUntil<unknown>(bobSocket, SOCKET_EVENTS.typingUpdate, bobStopped);
    const carolSaw = collectUntil<unknown>(carolSocket, SOCKET_EVENTS.typingUpdate, bobStopped);
    const aliceSaw = collectUntil<unknown>(aliceTab2, SOCKET_EVENTS.typingUpdate, bobStopped);

    aliceSocket.emit(SOCKET_EVENTS.typing, { conversationId: direct.id, typing: true });
    aliceSocket.emit(SOCKET_EVENTS.typing, { conversationId: 'nope', typing: true });
    // Carol is not in this conversation: nothing is relayed for her.
    carolSocket.emit(SOCKET_EVENTS.typing, { conversationId: direct.id, typing: true });
    aliceSocket.emit(SOCKET_EVENTS.typing, { conversationId: direct.id, typing: false });

    expect(await bobSaw).toEqual([
      { conversationId: direct.id, userId: alice.id, typing: true },
      { conversationId: direct.id, userId: alice.id, typing: false },
    ]);
    expect(await carolSaw).toEqual([]);
    expect(await aliceSaw).toEqual([]);
  });

  it('rate limits socket sends per user', async () => {
    const spammer = await createUser(t.prisma);
    const { agent, token } = await sessionFor(t, spammer);
    const socket = connect(t, { token });
    sockets.push(socket);
    await connected(socket);
    const direct = await directWith(agent, bob.id);

    const results = [];
    for (let i = 0; i < 61; i += 1) {
      // oxlint-disable-next-line no-await-in-loop -- sequential on purpose: the window counts calls
      const ack = await socket.emitWithAck(SOCKET_EVENTS.messageSend, {
        conversationId: direct.id,
        content: `m${i}`,
      });
      results.push(messageAckSchema.parse(ack));
    }
    expect(results.slice(0, 60).every((r) => r.ok)).toBe(true);
    expect(results[60]).toMatchObject({ ok: false, error: { code: 'TOO_MANY_REQUESTS' } });
  });

  it('rate limits typing signals per user by dropping them', async () => {
    const chatterbox = await createUser(t.prisma);
    const { agent, token } = await sessionFor(t, chatterbox);
    const socket = connect(t, { token });
    const bobSocket = connect(t, { token: bobSession.token });
    sockets.push(socket, bobSocket);
    await Promise.all([connected(socket), connected(bobSocket)]);
    const direct = await directWith(agent, bob.id);

    const received: unknown[] = [];
    bobSocket.on(SOCKET_EVENTS.typingUpdate, (payload: unknown) => received.push(payload));
    for (let i = 0; i < 125; i += 1) {
      socket.emit(SOCKET_EVENTS.typing, { conversationId: direct.id, typing: true });
    }
    // The limiter decides on receipt; the relays drain one after another, then nothing more comes.
    await until(() => received.length >= 120);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(received).toHaveLength(120);
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
    await request(t.server).get('/api/v1/conversations').expect(401);
    await request(t.server).put(`/api/v1/conversations/direct/${bob.id}`).expect(401);
    await request(t.server)
      .post(`/api/v1/conversations/${bob.id}/messages`)
      .send({ content: 'x' })
      .expect(401);
  });
});
