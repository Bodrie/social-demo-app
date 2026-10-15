import { Logger } from '@nestjs/common';
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
  type ConversationReadEvent as ConversationReadPayload,
  type MessageAck,
  SOCKET_EVENTS,
  markReadEventSchema,
  sendMessageEventSchema,
} from '@the-mesh/shared';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { assetUrl } from '../common/assets.js';
import { fieldsFromIssues, toApiError } from '../common/filters/http-exception.filter.js';
import type { Env } from '../config/env.js';
import { ConversationReadEvent, MessageSentEvent } from '../events/message.events.js';
import { MessagesService } from '../messages/messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { authenticateSocket } from './handshake.js';
import { PresenceService } from './presence.service.js';

type SocketData = { userId: string };
type ChatSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export const userRoom = (userId: string): string => `user:${userId}`;

/**
 * Presence and direct messages on the same HTTP server as the REST API.
 * Every socket is authenticated at handshake; nothing about the user is
 * trusted from the client. Messages are persisted by MessagesService and
 * delivered here through domain events, so HTTP and socket sends behave alike.
 */
@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly assetsBase: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly messages: MessagesService,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  afterInit(server: Server): void {
    server.use((socket: ChatSocket, next) => {
      void (async () => {
        const userId = await authenticateSocket(socket, this.jwt).catch(() => undefined);
        if (!userId) {
          next(new Error('Unauthorized'));
          return;
        }
        socket.data.userId = userId;
        next();
      })();
    });
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    const userId = socket.data.userId;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, avatarKey: true },
    });
    if (!user) {
      socket.disconnect(true);
      return;
    }
    await socket.join(userRoom(userId));
    const cameOnline = this.presence.add(
      { id: user.id, username: user.username, name: user.name, avatarUrl: assetUrl(user.avatarKey, this.assetsBase) },
      socket.id,
    );
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
      this.broadcastPresence();
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.messageSend)
  async onSend(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<MessageAck> {
    const parsed = sendMessageEventSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', fields: fieldsFromIssues(parsed.error.issues) },
      };
    }
    try {
      const message = await this.messages.send(socket.data.userId, parsed.data.recipientId, { content: parsed.data.content });
      return { ok: true, message };
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.messageRead)
  async onRead(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<{ ok: boolean; count?: number }> {
    const parsed = markReadEventSchema.safeParse(body);
    if (!parsed.success) return { ok: false };
    try {
      const { count } = await this.messages.markRead(socket.data.userId, parsed.data.userId);
      return { ok: true, count };
    } catch {
      return { ok: false };
    }
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
    const payload: ConversationReadPayload = { userId: event.readerId, readAt: event.readAt.toISOString() };
    this.server.to(userRoom(event.peerId)).emit(SOCKET_EVENTS.conversationRead, payload);
  }

  private broadcastPresence(): void {
    try {
      this.server.emit(SOCKET_EVENTS.presenceUpdate, this.presence.list());
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not broadcast presence');
    }
  }
}
