import { SOCKET_EVENTS } from '@the-mesh/shared';
import { makeMessage } from './fixtures';
import { mockDb } from './msw/db';

type Handler = (...args: unknown[]) => void;
type AckHandler = (payload: unknown) => unknown;

/**
 * Stands in for socket.io-client in jsdom. Tests drive the "server" side with
 * `serverEmit()` and inspect what the app sent through `emitted`.
 */
export class FakeSocket {
  connected = false;
  emitted: { event: string; payload: unknown }[] = [];
  ackHandlers: Record<string, AckHandler> = {};
  readonly #handlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): this {
    const set = this.#handlers.get(event) ?? new Set<Handler>();
    set.add(handler);
    this.#handlers.set(event, set);
    return this;
  }

  off(event: string, handler?: Handler): this {
    if (handler) this.#handlers.get(event)?.delete(handler);
    else this.#handlers.delete(event);
    return this;
  }

  connect(): this {
    if (!this.connected) {
      this.connected = true;
      queueMicrotask(() => this.fire('connect'));
    }
    return this;
  }

  disconnect(): this {
    if (this.connected) {
      this.connected = false;
      this.fire('disconnect', 'io client disconnect');
    }
    return this;
  }

  timeout(): this {
    return this;
  }

  emit(event: string, payload: unknown, ack?: (result: unknown) => void): this {
    this.emitted.push({ event, payload });
    const answer = this.ackHandlers[event]?.(payload);
    if (ack && answer !== undefined) queueMicrotask(() => ack(answer));
    return this;
  }

  async emitWithAck(event: string, payload: unknown): Promise<unknown> {
    this.emitted.push({ event, payload });
    const handler = this.ackHandlers[event];
    if (!handler) throw new Error(`No ack handler for ${event}`);
    await Promise.resolve();
    return handler(payload);
  }

  /** A push from the server. */
  serverEmit(event: string, ...args: unknown[]): void {
    this.fire(event, ...args);
  }

  /** The server closed the connection (token expiry, revoked sessions). */
  serverDisconnect(): void {
    this.connected = false;
    this.fire('disconnect', 'io server disconnect');
  }

  listenerCount(event: string): number {
    return this.#handlers.get(event)?.size ?? 0;
  }

  reset(): void {
    this.connected = false;
    this.emitted = [];
    this.#handlers.clear();
    this.ackHandlers = defaultAckHandlers(this);
  }

  private fire(event: string, ...args: unknown[]): void {
    for (const handler of Array.from(this.#handlers.get(event) ?? [])) handler(...args);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Mirrors the real gateway: sends persist and are pushed back as `message:new`; reads mark the peer's messages. */
function defaultAckHandlers(socket: FakeSocket): Record<string, AckHandler> {
  return {
    [SOCKET_EVENTS.messageSend]: (payload) => {
      const user = mockDb.user;
      if (
        !user ||
        !isRecord(payload) ||
        typeof payload.recipientId !== 'string' ||
        typeof payload.content !== 'string'
      ) {
        return {
          ok: false,
          error: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation failed' },
        };
      }
      const message = makeMessage(user.id, payload.recipientId, payload.content, {
        createdAt: new Date().toISOString(),
      });
      mockDb.messages.push(message);
      queueMicrotask(() => socket.serverEmit(SOCKET_EVENTS.messageNew, message));
      return { ok: true, message };
    },
    [SOCKET_EVENTS.messageRead]: (payload) => {
      const user = mockDb.user;
      if (!user || !isRecord(payload) || typeof payload.userId !== 'string') {
        return {
          ok: false,
          error: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation failed' },
        };
      }
      const readAt = new Date().toISOString();
      let count = 0;
      for (const message of mockDb.messages) {
        if (
          message.senderId === payload.userId &&
          message.recipientId === user.id &&
          !message.readAt
        ) {
          message.readAt = readAt;
          count += 1;
        }
      }
      return { ok: true, count };
    },
  };
}

export const fakeSocket = new FakeSocket();
fakeSocket.reset();
