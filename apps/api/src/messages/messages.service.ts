import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Conversation, CursorQuery, Message, Paginated, SendMessageData } from '@the-mesh/shared';
import { assetUrl } from '../common/assets.js';
import { decodeCursor, paginate } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { ConversationReadEvent, MessageSentEvent } from '../events/message.events.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { messageSelect, toMessage } from './messages.mapper.js';

const CONVERSATION_LIMIT = 100;

type LatestRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: Date | string;
  read_at: Date | string | null;
  peer_id: string;
};

type UnreadRow = { sender_id: string; unread: number | bigint };

@Injectable()
export class MessagesService {
  private readonly assetsBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  async send(senderId: string, recipientId: string, input: SendMessageData): Promise<Message> {
    if (senderId === recipientId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'You cannot message yourself' });
    }
    await this.assertUserExists(recipientId);
    const row = await this.prisma.message.create({
      data: { senderId, recipientId, content: input.content },
      select: messageSelect,
    });
    const message = toMessage(row);
    await this.events.emitAsync(MessageSentEvent.EVENT, new MessageSentEvent(message));
    return message;
  }

  /** Messages between the viewer and `peerId`, newest first. */
  async history(viewerId: string, peerId: string, query: CursorQuery): Promise<Paginated<Message>> {
    await this.assertUserExists(peerId);
    const cursorId = decodeCursor(query.cursor);
    const rows = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: viewerId, recipientId: peerId },
          { senderId: peerId, recipientId: viewerId },
        ],
      },
      select: messageSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    return paginate(rows, query.limit, toMessage);
  }

  /** Marks everything `peerId` sent to the viewer as read; tells the peer when something changed. */
  async markRead(viewerId: string, peerId: string): Promise<{ count: number }> {
    await this.assertUserExists(peerId);
    const readAt = new Date();
    const result = await this.prisma.message.updateMany({
      where: { senderId: peerId, recipientId: viewerId, readAt: null },
      data: { readAt },
    });
    if (result.count > 0) {
      await this.events.emitAsync(
        ConversationReadEvent.EVENT,
        new ConversationReadEvent(viewerId, peerId, readAt),
      );
    }
    return { count: result.count };
  }

  /** One entry per chat partner, most recent conversation first. */
  async conversations(viewerId: string): Promise<Conversation[]> {
    const latest = await this.prisma.$queryRaw<LatestRow[]>(Prisma.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (peer_id)
          m.id, m.sender_id, m.recipient_id, m.content, m.created_at, m.read_at,
          CASE WHEN m.sender_id = ${viewerId}::uuid THEN m.recipient_id ELSE m.sender_id END AS peer_id
        FROM "messages" m
        WHERE m.sender_id = ${viewerId}::uuid OR m.recipient_id = ${viewerId}::uuid
        ORDER BY peer_id, m.created_at DESC, m.id DESC
      ) latest
      ORDER BY created_at DESC, id DESC
      LIMIT ${CONVERSATION_LIMIT}
    `);
    if (latest.length === 0) return [];

    const unreadRows = await this.prisma.$queryRaw<UnreadRow[]>(Prisma.sql`
      SELECT sender_id, COUNT(*)::int AS unread
      FROM "messages"
      WHERE recipient_id = ${viewerId}::uuid AND read_at IS NULL
      GROUP BY sender_id
    `);
    const unreadByPeer = new Map(unreadRows.map((row) => [row.sender_id, Number(row.unread)]));

    const peers = await this.prisma.user.findMany({
      where: { id: { in: latest.map((row) => row.peer_id) } },
      select: { id: true, username: true, name: true, avatarKey: true },
    });
    const peerById = new Map(peers.map((peer) => [peer.id, peer]));

    return latest.flatMap((row) => {
      const peer = peerById.get(row.peer_id);
      if (!peer) return [];
      return [
        {
          peer: { id: peer.id, username: peer.username, name: peer.name, avatarUrl: assetUrl(peer.avatarKey, this.assetsBase) },
          lastMessage: toMessage({
            id: row.id,
            senderId: row.sender_id,
            recipientId: row.recipient_id,
            content: row.content,
            createdAt: new Date(row.created_at),
            readAt: row.read_at === null ? null : new Date(row.read_at),
          }),
          unreadCount: unreadByPeer.get(peer.id) ?? 0,
        },
      ];
    });
  }

  private async assertUserExists(userId: string): Promise<void> {
    const count = await this.prisma.user.count({ where: { id: userId } });
    if (count === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
  }
}
