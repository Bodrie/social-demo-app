import {
  SOCKET_EVENTS,
  conversationReadEventSchema,
  conversationSchema,
  messageAckSchema,
  messageListSchema,
  messageSchema,
  presenceUpdateSchema,
} from '@the-mesh/shared';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import { z } from 'zod';
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

const presenceIds = (payload: unknown): string[] =>
  presenceUpdateSchema
    .parse(payload)
    .map((u) => u.id)
    .toSorted();

describe('chat', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let aliceSession: { agent: TestAgent; token: string };
  let bobSession: { agent: TestAgent; token: string };
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
    alice = await createUser(t.prisma);
    bob = await createUser(t.prisma);
    aliceSession = await sessionFor(t, alice);
    bobSession = await sessionFor(t, bob);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('refuses sockets without a valid session', async () => {
    const anonymous = connect(t, {});
    const forged = connect(t, { token: 'not-a-token' });
    sockets.push(anonymous, forged);

    expect((await connectError(anonymous)).message).toBe('Unauthorized');
    expect((await connectError(forged)).message).toBe('Unauthorized');
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

    // Closing one of Alice's tabs must not report her offline.
    const afterTabClose = waitFor<unknown>(bobSocket, SOCKET_EVENTS.presenceUpdate);
    aliceTab2.disconnect();
    await expect(Promise.race([afterTabClose, new Promise((resolve) => setTimeout(() => resolve('none'), 300))])).resolves.toBe('none');

    const afterAliceLeft = waitFor<unknown>(bobSocket, SOCKET_EVENTS.presenceUpdate, (p) => presenceIds(p).length === 1);
    aliceSocket.disconnect();
    expect(presenceIds(await afterAliceLeft)).toEqual([bob.id]);
  });

  it('delivers persisted messages to both parties and exposes history, conversations and read receipts', async () => {
    const aliceSocket = connect(t, { token: aliceSession.token });
    const aliceTab2 = connect(t, { token: aliceSession.token });
    const bobSocket = connect(t, { token: bobSession.token });
    sockets.push(aliceSocket, aliceTab2, bobSocket);
    await Promise.all([connected(aliceSocket), connected(aliceTab2), connected(bobSocket)]);

    const bobReceives = waitFor<unknown>(bobSocket, SOCKET_EVENTS.messageNew);
    const aliceTabReceives = waitFor<unknown>(aliceTab2, SOCKET_EVENTS.messageNew);
    const ack = messageAckSchema.parse(
      await aliceSocket.emitWithAck(SOCKET_EVENTS.messageSend, { recipientId: bob.id, content: '  hello bob  ' }),
    );
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.message).toMatchObject({ senderId: alice.id, recipientId: bob.id, content: 'hello bob', readAt: null });
    expect(messageSchema.parse(await bobReceives).id).toBe(ack.message.id);
    expect(messageSchema.parse(await aliceTabReceives).id).toBe(ack.message.id);

    // HTTP sending reaches open sockets the same way.
    const bobReceivesHttp = waitFor<unknown>(bobSocket, SOCKET_EVENTS.messageNew);
    const viaHttp = messageSchema.parse((await aliceSession.agent.post(`/api/v1/messages/${bob.id}`).send({ content: 'and via http' }).expect(201)).body);
    expect(messageSchema.parse(await bobReceivesHttp).id).toBe(viaHttp.id);

    const history = messageListSchema.parse((await bobSession.agent.get(`/api/v1/messages/${alice.id}`).expect(200)).body);
    expect(history.items.map((m) => m.content)).toEqual(['and via http', 'hello bob']);

    const bobConversations = z.array(conversationSchema).parse((await bobSession.agent.get('/api/v1/messages').expect(200)).body);
    expect(bobConversations).toHaveLength(1);
    expect(bobConversations[0]).toMatchObject({ peer: { id: alice.id }, lastMessage: { id: viaHttp.id }, unreadCount: 2 });

    const aliceNotified = waitFor<unknown>(aliceSocket, SOCKET_EVENTS.conversationRead);
    const readAck = await bobSocket.emitWithAck(SOCKET_EVENTS.messageRead, { userId: alice.id });
    expect(readAck).toEqual({ ok: true, count: 2 });
    expect(conversationReadEventSchema.parse(await aliceNotified).userId).toBe(bob.id);

    const aliceConversations = z.array(conversationSchema).parse((await aliceSession.agent.get('/api/v1/messages').expect(200)).body);
    expect(aliceConversations[0]).toMatchObject({ peer: { id: bob.id }, unreadCount: 0 });
    expect(aliceConversations[0]?.lastMessage.readAt).not.toBeNull();
    expect((await bobSession.agent.post(`/api/v1/messages/${alice.id}/read`).expect(200)).body).toEqual({ count: 0 });
  });

  it('validates socket sends and reports errors in the ack', async () => {
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
  });

  it('requires a session on the HTTP endpoints', async () => {
    await request(t.server).get('/api/v1/messages').expect(401);
    await request(t.server).post(`/api/v1/messages/${bob.id}`).send({ content: 'x' }).expect(401);
  });
});
