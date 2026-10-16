import { JwtService } from '@nestjs/jwt';
import type { UserSummary } from '@the-mesh/shared';
import type { Server } from 'socket.io';
import { mockDeep } from 'vitest-mock-extended';
import type { ConversationsService } from '../conversations/conversations.service.js';
import type { UsersService } from '../users/users.service.js';
import {
  CONNECT_LIMIT,
  ChatGateway,
  PRESENCE_BROADCAST_DELAY_MS,
  PRESENCE_ROOM,
} from './chat.gateway.js';
import { PresenceService } from './presence.service.js';

type ChatSocket = Parameters<ChatGateway['handleConnection']>[0];

const jwt = new JwtService({
  secret: 'unit-test-secret-unit-test-secret-unit-test',
  signOptions: { expiresIn: 60 },
});

const summary = (n: number): UserSummary => ({
  id: `0199b6a0-0000-7000-8000-00000000000${n}`,
  username: `user${n}`,
  name: `User ${n}`,
  avatarUrl: null,
});

function connectedSocket(userId: string) {
  const socket = {
    id: `socket-${userId}`,
    data: { userId, expiresAt: null },
    disconnected: false,
    conn: { close: vi.fn() },
    join: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    once: vi.fn(),
  };
  return { socket, chatSocket: socket as unknown as ChatSocket };
}

describe('ChatGateway', () => {
  let users: ReturnType<typeof mockDeep<UsersService>>;
  let presence: PresenceService;
  let gateway: ChatGateway;
  let broadcast: ReturnType<typeof vi.fn>;
  let server: { to: ReturnType<typeof vi.fn>; use: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    users = mockDeep<UsersService>();
    presence = new PresenceService();
    gateway = new ChatGateway(jwt, users, presence, mockDeep<ConversationsService>());
    broadcast = vi.fn();
    server = { to: vi.fn(() => ({ emit: broadcast })), use: vi.fn() };
    gateway.server = server as unknown as Server;
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    vi.useRealTimers();
  });

  it('survives a failing lookup at connection: logs, closes the transport, registers nothing', async () => {
    users.summary.mockRejectedValue(new Error('connection pool timeout'));
    const { socket, chatSocket } = connectedSocket(summary(1).id);

    // Nest ignores the returned promise; it must never reject.
    await expect(gateway.handleConnection(chatSocket)).resolves.toBeUndefined();

    expect(socket.conn.close).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(presence.list()).toEqual([]);
  });

  it('sends one presence list for a burst of arrivals, to registered sockets only', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const people = [summary(1), summary(2), summary(3)];
    const sockets = people.map((person) => connectedSocket(person.id));
    for (const [i, person] of people.entries()) {
      users.summary.mockResolvedValueOnce(person);
      // oxlint-disable-next-line no-await-in-loop -- one after the other, like real handshakes
      await gateway.handleConnection(sockets[i]?.chatSocket as ChatSocket);
    }
    expect(broadcast).not.toHaveBeenCalled();
    for (const { socket } of sockets) expect(socket.join).toHaveBeenCalledWith(PRESENCE_ROOM);

    vi.advanceTimersByTime(PRESENCE_BROADCAST_DELAY_MS);
    expect(server.to).toHaveBeenCalledWith(PRESENCE_ROOM);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledWith('presence:update', people);
  });

  it('refuses a user who keeps reconnecting, even though no socket stays open', async () => {
    gateway.afterInit(server as unknown as Server);
    const middleware = server.use.mock.calls[0]?.[0] as (
      socket: unknown,
      next: (error?: Error) => void,
    ) => void;
    const token = await jwt.signAsync({ sub: summary(1).id });
    const handshake = () => {
      const socket = { handshake: { headers: {}, auth: { token } }, data: {} };
      return new Promise<{ socket: typeof socket; error?: Error }>((resolve) =>
        middleware(socket, (error) => resolve({ socket, error })),
      );
    };

    for (let i = 0; i < CONNECT_LIMIT.limit; i += 1) {
      // oxlint-disable-next-line no-await-in-loop -- sequential on purpose
      const { socket, error } = await handshake();
      expect(error).toBeUndefined();
      gateway.handleDisconnect(socket as unknown as ChatSocket);
    }
    expect((await handshake()).error?.message).toBe('Too many connections');
  });
});
