import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  type ApiError,
  type ConversationReadPayload,
  type ConversationRef,
  type MarkReadAck,
  type MessageAck,
  SOCKET_EVENTS,
  type TypingUpdate,
  markReadPayloadSchema,
  sendMessagePayloadSchema,
  typingPayloadSchema,
} from '@the-mesh/shared';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { fieldsFromIssues, toApiError } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { SessionsRevokedEvent } from '../events/auth.events.js';
import {
  ConversationDeletedEvent,
  ConversationLeftEvent,
  ConversationReadEvent,
  ConversationUpdatedEvent,
  MessageSentEvent,
} from '../events/conversation.events.js';
import { ProfileUpdatedEvent } from '../events/user.events.js';
import { UsersService } from '../users/users.service.js';
import { authenticateSocket } from './handshake.js';
import { PresenceService } from './presence.service.js';
import { SocketRateLimiter } from './rate-limiter.js';

type SocketData = {
  userId: string;
  expiresAt: Date | null;
  /** Typing relays of this socket, in order (see onTyping). */
  typingQueue?: Promise<void>;
};
type ChatSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const userRoom = (userId: string): string => `user:${userId}`;
const userRooms = (userIds: readonly string[]): string[] => userIds.map(userRoom);
/** Sockets whose user is in the presence list; a socket still being set up gets no list. */
export const PRESENCE_ROOM = 'presence';

/** Default for `SOCKET_MAX_PER_USER`: open sockets per user (tabs/devices); more are refused at handshake. */
export const MAX_SOCKETS_PER_USER = 5;
/**
 * Default for `SOCKET_CONNECTS_PER_MINUTE`: authenticated handshakes per user and minute,
 * accepted or not. Plenty for a few tabs on a flaky network, not for a connect/disconnect loop
 * (each one costs a lookup and a broadcast). Both limits are per user, so a test run in which
 * every browser is the same member raises them through the environment.
 */
export const CONNECT_LIMIT = { limit: 30, windowMs: 60_000 };
/** Presence changes within this window go out as one broadcast of the list. */
export const PRESENCE_BROADCAST_DELAY_MS = 1000;
const SEND_LIMIT = { limit: 60, windowMs: 60_000 };
const READ_LIMIT = { limit: 120, windowMs: 60_000 };
/** A composer signals at most every few seconds; anything faster is a misbehaving client. */
const TYPING_LIMIT = { limit: 120, windowMs: 60_000 };

type AckFailure = { ok: false; error: ApiError };

const tooMany = (message: string): AckFailure => ({
  ok: false,
  error: { statusCode: 429, code: 'TOO_MANY_REQUESTS', message },
});

/**
 * Presence and messaging on the same HTTP server as the REST API.
 * Every socket is authenticated at handshake and lives at most as long as its
 * access token; nothing about the user is trusted from the client. Messages
 * are persisted by ConversationsService and delivered here through domain
 * events to every member's room, so HTTP and socket sends behave alike.
 */
@WebSocketGateway()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly sendLimiter = new SocketRateLimiter(SEND_LIMIT.limit, SEND_LIMIT.windowMs);
  private readonly readLimiter = new SocketRateLimiter(READ_LIMIT.limit, READ_LIMIT.windowMs);
  private readonly typingLimiter = new SocketRateLimiter(TYPING_LIMIT.limit, TYPING_LIMIT.windowMs);
  /** Never forgotten on disconnect (that would reset it for a loop); expired windows are swept. */
  private readonly connectLimiter: SocketRateLimiter;
  private readonly maxSocketsPerUser: number;
  /** Accepted handshakes per user. Presence fills in later (after a lookup), so the cap counts here. */
  private readonly socketsByUser = new Map<string, number>();
  private presenceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly presence: PresenceService,
    private readonly conversations: ConversationsService,
    config: ConfigService<Env, true>,
  ) {
    this.maxSocketsPerUser = config.get('SOCKET_MAX_PER_USER', { infer: true });
    this.connectLimiter = new SocketRateLimiter(
      config.get('SOCKET_CONNECTS_PER_MINUTE', { infer: true }),
      CONNECT_LIMIT.windowMs,
    );
  }

  afterInit(server: Server): void {
    server.use((socket: ChatSocket, next) => {
      void (async () => {
        const session = await authenticateSocket(socket, this.jwt).catch(() => undefined);
        if (!session) {
          next(new Error('Unauthorized'));
          return;
        }
        // Same refusal as the cap below, so the client backs off and knocks again later.
        if (!this.connectLimiter.allow(session.userId)) {
          next(new Error('Too many connections'));
          return;
        }
        const open = this.socketsByUser.get(session.userId) ?? 0;
        if (open >= this.maxSocketsPerUser) {
          next(new Error('Too many connections'));
          return;
        }
        this.socketsByUser.set(session.userId, open + 1);
        socket.data.userId = session.userId;
        socket.data.expiresAt = session.expiresAt;
        next();
      })();
    });
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    const userId = socket.data.userId;
    this.expireWithToken(socket);

    // Nest drops the promise this hook returns, so nothing may escape it: an unhandled
    // rejection (a database hiccup during a reconnect wave) would end the process.
    try {
      const user = await this.users.summary(userId);
      if (!user || socket.disconnected) {
        socket.disconnect(true);
        return;
      }
      await socket.join(userRoom(userId));

      const cameOnline = this.presence.add(user, socket.id);
      if (socket.disconnected) {
        // Dropped while we were looking the user up: undo without ever showing them online.
        this.presence.remove(userId, socket.id);
        return;
      }
      // Only now: a broadcast that was already scheduled must not reach a socket whose user it
      // leaves out.
      await socket.join(PRESENCE_ROOM);
      if (cameOnline) {
        // Everyone, this socket included, gets the list with the next broadcast.
        this.broadcastPresence();
      } else {
        // Another tab of a user who is already online: only that tab needs the list.
        socket.emit(SOCKET_EVENTS.presenceUpdate, this.presence.list());
      }
    } catch (error) {
      this.logger.error({ err: error, userId }, 'Could not set up a socket connection');
      // Close the transport, not the namespace: the client then reconnects on its own with
      // back-off, as after a network drop, instead of treating it as an ended session.
      // handleDisconnect cleans up whatever was registered.
      socket.conn.close();
    }
  }

  handleDisconnect(socket: ChatSocket): void {
    const userId = socket.data.userId;
    if (!userId) return;
    const open = (this.socketsByUser.get(userId) ?? 1) - 1;
    if (open > 0) this.socketsByUser.set(userId, open);
    else this.socketsByUser.delete(userId);
    if (this.presence.remove(userId, socket.id)) {
      this.sendLimiter.forget(userId);
      this.readLimiter.forget(userId);
      this.typingLimiter.forget(userId);
      this.broadcastPresence();
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.messageSend)
  async onSend(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: unknown,
  ): Promise<MessageAck> {
    const userId = socket.data.userId;
    if (!this.sendLimiter.allow(userId)) return tooMany('Too many messages, slow down');
    const parsed = sendMessagePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: fieldsFromIssues(parsed.error.issues),
        },
      };
    }
    try {
      const { conversationId, ...input } = parsed.data;
      const message = await this.conversations.send(userId, conversationId, input);
      return { ok: true, message };
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.messageRead)
  async onRead(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: unknown,
  ): Promise<MarkReadAck> {
    const userId = socket.data.userId;
    if (!this.readLimiter.allow(userId)) return tooMany('Too many requests, slow down');
    const parsed = markReadPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: fieldsFromIssues(parsed.error.issues),
        },
      };
    }
    try {
      const { readAt } = await this.conversations.markRead(userId, parsed.data.conversationId);
      return { ok: true, readAt };
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  /**
   * Typing is ephemeral: relayed to the other members' open tabs, never stored, no ack.
   * Invalid payloads and conversations the sender is not in are dropped silently; the
   * client expires a stale "typing" on its own, so a lost "stopped" costs nothing.
   */
  @SubscribeMessage(SOCKET_EVENTS.typing)
  onTyping(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): void {
    const userId = socket.data.userId;
    if (!this.typingLimiter.allow(userId)) return;
    const parsed = typingPayloadSchema.safeParse(body);
    if (!parsed.success) return;
    const { conversationId, typing } = parsed.data;
    // The membership lookup is async; chaining per socket keeps "stopped" from overtaking "started".
    const previous = socket.data.typingQueue ?? Promise.resolve();
    socket.data.typingQueue = previous
      .then(async () => {
        const others = await this.conversations.otherMemberIds(userId, conversationId);
        const payload: TypingUpdate = { conversationId, userId, typing };
        this.emitTo(others, SOCKET_EVENTS.typingUpdate, payload);
        return undefined;
      })
      .catch((error: unknown) => this.logger.warn({ err: error }, 'Could not relay typing'));
  }

  @OnEvent(MessageSentEvent.EVENT)
  onMessageSent(event: MessageSentEvent): void {
    this.emitTo(event.memberIds, SOCKET_EVENTS.messageNew, event.message);
  }

  @OnEvent(ConversationReadEvent.EVENT)
  onConversationRead(event: ConversationReadEvent): void {
    const payload: ConversationReadPayload = {
      conversationId: event.conversationId,
      userId: event.readerId,
      readAt: event.readAt.toISOString(),
    };
    this.emitTo(event.memberIds, SOCKET_EVENTS.conversationRead, payload);
  }

  @OnEvent(ConversationUpdatedEvent.EVENT)
  onConversationUpdated(event: ConversationUpdatedEvent): void {
    const payload: ConversationRef = { conversationId: event.conversationId };
    this.emitTo(event.memberIds, SOCKET_EVENTS.conversationUpdate, payload);
  }

  @OnEvent(ConversationDeletedEvent.EVENT)
  onConversationDeleted(event: ConversationDeletedEvent): void {
    const payload: ConversationRef = { conversationId: event.conversationId };
    this.emitTo(event.memberIds, SOCKET_EVENTS.conversationRemoved, payload);
  }

  @OnEvent(ConversationLeftEvent.EVENT)
  onConversationLeft(event: ConversationLeftEvent): void {
    const payload: ConversationRef = { conversationId: event.conversationId };
    this.emitTo(event.memberIds, SOCKET_EVENTS.conversationUpdate, payload);
    this.emitTo([event.userId], SOCKET_EVENTS.conversationRemoved, payload);
  }

  /** logout-all or refresh-token reuse: every open socket of the user is cut. */
  @OnEvent(SessionsRevokedEvent.EVENT)
  onSessionsRevoked(event: SessionsRevokedEvent): void {
    this.server.in(userRoom(event.userId)).disconnectSockets(true);
  }

  /** Keep the presence list current when an online user changes name or avatar. */
  @OnEvent(ProfileUpdatedEvent.EVENT)
  async onProfileUpdated(event: ProfileUpdatedEvent): Promise<void> {
    if (
      !event.changedFields.some(
        (field) => field === 'name' || field === 'username' || field === 'avatarKey',
      )
    )
      return;
    const user = await this.users.summary(event.userId);
    if (user && this.presence.refresh(user)) this.broadcastPresence();
  }

  /** A socket never outlives the access token it was opened with. */
  private expireWithToken(socket: ChatSocket): void {
    const expiresAt = socket.data.expiresAt;
    if (!expiresAt) return;
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(expiresAt.getTime() - Date.now(), 0),
    );
    socket.once('disconnect', () => clearTimeout(timer));
  }

  /** Never `to([])`: an empty room list would broadcast to every socket. */
  private emitTo(userIds: readonly string[], event: string, payload: unknown): void {
    if (userIds.length === 0) return;
    this.server.to(userRooms(userIds)).emit(event, payload);
  }

  /**
   * Schedules one broadcast of the list as it is then: however many people come and go in
   * the meantime (a reconnect wave after a deploy, a client in a loop), every socket gets at
   * most one list per PRESENCE_BROADCAST_DELAY_MS.
   */
  private broadcastPresence(): void {
    if (this.presenceTimer) return;
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = undefined;
      try {
        this.server.to(PRESENCE_ROOM).emit(SOCKET_EVENTS.presenceUpdate, this.presence.list());
      } catch (error) {
        this.logger.warn({ err: error }, 'Could not broadcast presence');
      }
    }, PRESENCE_BROADCAST_DELAY_MS);
  }

  onModuleDestroy(): void {
    clearTimeout(this.presenceTimer);
    this.presenceTimer = undefined;
  }
}
