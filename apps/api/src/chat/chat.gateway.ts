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
import { SessionsRevokedEvent } from '../events/auth.events.js';
import { ConversationReadEvent, MessageSentEvent } from '../events/message.events.js';
import { ProfileUpdatedEvent } from '../events/user.events.js';
import { MessagesService } from '../messages/messages.service.js';
import { UsersService } from '../users/users.service.js';
import { authenticateSocket } from './handshake.js';
import { PresenceService } from './presence.service.js';
import { SocketRateLimiter } from './rate-limiter.js';

type SocketData = { userId: string; expiresAt: Date | null };
type ChatSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const userRoom = (userId: string): string => `user:${userId}`;

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
 * Presence and direct messages on the same HTTP server as the REST API.
 * Every socket is authenticated at handshake and lives at most as long as its
 * access token; nothing about the user is trusted from the client. Messages
 * are persisted by MessagesService and delivered here through domain events,
 * so HTTP and socket sends behave alike.
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
    private readonly messages: MessagesService,
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
      const { recipientId, ...input } = parsed.data;
      const message = await this.messages.send(userId, recipientId, input);
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
      const { count } = await this.messages.markRead(userId, parsed.data.userId);
      return { ok: true, count };
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  /**
   * Typing is ephemeral: relayed to the recipient's open tabs, never stored, no ack.
   * Invalid or self-addressed payloads are dropped silently; the client expires a
   * stale "typing" on its own, so a lost "stopped" costs nothing.
   */
  @SubscribeMessage(SOCKET_EVENTS.typing)
  onTyping(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): void {
    const userId = socket.data.userId;
    if (!this.typingLimiter.allow(userId)) return;
    const parsed = typingPayloadSchema.safeParse(body);
    if (!parsed.success || parsed.data.recipientId === userId) return;
    const payload: TypingUpdate = { userId, typing: parsed.data.typing };
    this.server.to(userRoom(parsed.data.recipientId)).emit(SOCKET_EVENTS.typingUpdate, payload);
  }

  @OnEvent(MessageSentEvent.EVENT)
  onMessageSent(event: MessageSentEvent): void {
    this.server
      .to(userRoom(event.message.recipientId))
      .to(userRoom(event.message.senderId))
      .emit(SOCKET_EVENTS.messageNew, event.message);
  }

  @OnEvent(ConversationReadEvent.EVENT)
  onConversationRead(event: ConversationReadEvent): void {
    const payload: ConversationReadPayload = {
      userId: event.readerId,
      readAt: event.readAt.toISOString(),
    };
    this.server.to(userRoom(event.peerId)).emit(SOCKET_EVENTS.conversationRead, payload);
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

  private broadcastPresence(): void {
    try {
      this.server.emit(SOCKET_EVENTS.presenceUpdate, this.presence.list());
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not broadcast presence');
    }
  }
}
