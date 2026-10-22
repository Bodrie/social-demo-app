import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import type { TestApp } from './app.js';
import { TEST_PASSWORD, type CreatedUser, type TestAgent, cookiesFrom } from './factories.js';

// Socket.io clients for integration tests against `createTestApp({ listen: true })`.

/** Signs the user in; the agent keeps the cookies, `token` is the access token for a socket. */
export async function sessionFor(
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

export function connect(
  t: TestApp,
  options: { token?: string; cookie?: string; origin?: string },
): Socket {
  return io(t.baseUrl, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
    auth: options.token ? { token: options.token } : {},
    extraHeaders: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
    },
  });
}

export function waitFor<T>(
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
export async function collectUntil<T>(
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
export async function until(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop -- polling on purpose
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
    socket.connect();
  });
}

export function connectError(socket: Socket): Promise<Error> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => reject(new Error('expected the connection to be refused')));
    socket.once('connect_error', (error) => resolve(error));
    socket.connect();
  });
}

export function disconnected(socket: Socket): Promise<string> {
  return new Promise((resolve) => socket.once('disconnect', (reason) => resolve(reason)));
}
