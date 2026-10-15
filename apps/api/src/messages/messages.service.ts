import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  Conversation,
  CursorQuery,
  MarkReadResult,
  Message,
  Paginated,
  SendMessageData,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { badRequest } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { ConversationReadEvent, MessageSentEvent } from '../events/message.events.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';
import { UsersService } from '../users/users.service.js';
import { messageSelect, toMessage } from './messages.mapper.js';

const CONVERSATION_LIMIT = 100;

type LatestRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: Date;
  read_at: Date | null;
  peer_id: string;
};

type UnreadRow = { sender_id: string; unread: number };

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
  ) {}

  async send(senderId: string, recipientId: string, input: SendMessageData): Promise<Message> {
    if (senderId === recipientId) throw badRequest('You cannot message yourself');
    await this.users.assertExists(recipientId);
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
    await this.users.assertExists(peerId);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.message.findMany({
      where: {
        AND: [
          {
            OR: [
              { senderId: viewerId, recipientId: peerId },
              { senderId: peerId, recipientId: viewerId },
            ],
          },
          cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {},
        ],
      },
      select: messageSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, toMessage);
  }

  /** Marks everything `peerId` sent to the viewer as read; tells the peer when something changed. */
  async markRead(viewerId: string, peerId: string): Promise<MarkReadResult> {
    await this.users.assertExists(peerId);
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

  /** One entry per chat partner, most recent conversation first (capped; not paginated yet). */
  async conversations(viewerId: string): Promise<Paginated<Conversation>> {
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
    if (latest.length === 0) return { items: [], nextCursor: null };

    const unreadRows = await this.prisma.$queryRaw<UnreadRow[]>(Prisma.sql`
      SELECT sender_id, COUNT(*)::int AS unread
      FROM "messages"
      WHERE recipient_id = ${viewerId}::uuid AND read_at IS NULL
      GROUP BY sender_id
    `);
    const unreadByPeer = new Map(unreadRows.map((row) => [row.sender_id, row.unread]));

    const peers = await this.prisma.user.findMany({
      where: { id: { in: latest.map((row) => row.peer_id) } },
      select: userSummarySelect,
    });
    const peerById = new Map(peers.map((peer) => [peer.id, peer]));

    const items = latest.flatMap((row): Conversation[] => {
      const peer = peerById.get(row.peer_id);
      if (!peer) return [];
      return [
        {
          peer: toUserSummary(peer, this.assets.base),
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
    return { items, nextCursor: null };
  }
}
