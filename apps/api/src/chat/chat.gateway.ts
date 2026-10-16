import { Logger } from '@nestjs/common';
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
import { ConversationsService } from '../conversations/conversations.service.js';
import { SessionsRevokedEvent } from '../events/auth.events.js';
import {
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

/** Open sockets allowed per user (tabs/devices); more are refused at handshake. */
export const MAX_SOCKETS_PER_USER = 5;
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
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly sendLimiter = new SocketRateLimiter(SEND_LIMIT.limit, SEND_LIMIT.windowMs);
  private readonly readLimiter = new SocketRateLimiter(READ_LIMIT.limit, READ_LIMIT.windowMs);
  private readonly typingLimiter = new SocketRateLimiter(TYPING_LIMIT.limit, TYPING_LIMIT.windowMs);

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly presence: PresenceService,
    private readonly conversations: ConversationsService,
  ) {}

  afterInit(server: Server): void {
    server.use((socket: ChatSocket, next) => {
      void (async () => {
        const session = await authenticateSocket(socket, this.jwt).catch(() => undefined);
        if (!session) {
          next(new Error('Unauthorized'));
          return;
        }
        if (this.presence.socketCount(session.userId) >= MAX_SOCKETS_PER_USER) {
          next(new Error('Too many connections'));
          return;
        }
        socket.data.userId = session.userId;
        socket.data.expiresAt = session.expiresAt;
        next();
      })();
    });
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    const userId = socket.data.userId;
    this.expireWithToken(socket);

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
    if (cameOnline) {
      this.broadcastPresence();
    } else {
      // Another tab of a user who is already online: only that tab needs the list.
      socket.emit(SOCKET_EVENTS.presenceUpdate, this.presence.list());
    }
  }

  handleDisconnect(socket: ChatSocket): void {
    const userId = socket.data.userId;
    if (!userId) return;
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

  private broadcastPresence(): void {
    try {
      this.server.emit(SOCKET_EVENTS.presenceUpdate, this.presence.list());
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not broadcast presence');
    }
  }
}
