import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AddMembersInput,
  type Conversation,
  type CreateGroupInput,
  type CursorQuery,
  GROUP_MAX_MEMBERS,
  type MarkReadResult,
  type Message,
  type Paginated,
  type SendMessageData,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { badRequest, notFound } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import {
  ConversationLeftEvent,
  ConversationReadEvent,
  ConversationUpdatedEvent,
  MessageSentEvent,
} from '../events/conversation.events.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { UsersService } from '../users/users.service.js';
import {
  type ConversationRow,
  type MessageRow,
  conversationSelect,
  directKeyOf,
  memberIdsOf,
  messageSelect,
  toConversation,
  toMessage,
} from './conversations.mapper.js';

const CONVERSATION_LIMIT = 100;

type UnreadRow = { conversation_id: string; unread: number };

/**
 * Direct conversations exist once per pair and appear in the list only once something was
 * said; groups are created on purpose and show up right away. Every read goes through a
 * membership check, and non-members get a 404 so the existence of a group never leaks.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
    private readonly uploads: UploadsService,
  ) {}

  /** The one direct conversation between the caller and `userId`, created on first use. */
  async ensureDirect(meId: string, userId: string): Promise<Conversation> {
    if (meId === userId) throw badRequest('You cannot message yourself');
    await this.users.assertExists(userId);
    const directKey = directKeyOf(meId, userId);
    const existing = await this.prisma.conversation.findUnique({
      where: { directKey },
      select: conversationSelect,
    });
    if (existing) return this.withUnreadOne(existing, meId);
    try {
      const created = await this.prisma.conversation.create({
        data: { kind: 'direct', directKey, members: { create: [{ userId: meId }, { userId }] } },
        select: conversationSelect,
      });
      return toConversation(created, 0, this.assets.base);
    } catch (error) {
      // Two tabs opened the same thread at once: the other one won, use its row.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const row = await this.prisma.conversation.findUniqueOrThrow({
          where: { directKey },
          select: conversationSelect,
        });
        return this.withUnreadOne(row, meId);
      }
      throw error;
    }
  }

  async createGroup(meId: string, input: CreateGroupInput): Promise<Conversation> {
    const memberIds = await this.resolveMembers(meId, input.memberIds, 'memberIds');
    const row = await this.prisma.conversation.create({
      data: {
        kind: 'group',
        title: input.title,
        createdById: meId,
        members: { create: [meId, ...memberIds].map((userId) => ({ userId })) },
      },
      select: conversationSelect,
    });
    await this.events.emitAsync(
      ConversationUpdatedEvent.EVENT,
      new ConversationUpdatedEvent(row.id, memberIdsOf(row)),
    );
    return toConversation(row, 0, this.assets.base);
  }

  /** Most recent activity first (capped; not paginated yet). Direct threads need a message to show. */
  async list(meId: string): Promise<Paginated<Conversation>> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        members: { some: { userId: meId } },
        OR: [{ kind: 'group' }, { lastMessageAt: { not: null } }],
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: CONVERSATION_LIMIT,
      select: conversationSelect,
    });
    return { items: await this.withUnread(rows, meId), nextCursor: null };
  }

  async get(meId: string, id: string): Promise<Conversation> {
    return this.withUnreadOne(await this.rowForMember(meId, id), meId);
  }

  /** Messages in the conversation, newest first. */
  async history(meId: string, id: string, query: CursorQuery): Promise<Paginated<Message>> {
    await this.rowForMember(meId, id);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.message.findMany({
      where: {
        AND: [
          { conversationId: id },
          cursor ? keysetAfter(cursor, (messageId) => ({ id: { lt: messageId } })) : {},
        ],
      },
      select: messageSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, this.toMessage);
  }

  async send(meId: string, id: string, input: SendMessageData): Promise<Message> {
    const row = await this.rowForMember(meId, id);
    if (input.imageKey !== undefined) {
      await this.uploads.assertOwned(input.imageKey, {
        ownerId: meId,
        kind: 'message',
        field: 'imageKey',
      });
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: id,
          senderId: meId,
          content: input.content,
          imageKey: input.imageKey ?? null,
        },
        select: messageSelect,
      });
      // Two concurrent sends commit in any order; the stamp keeps the newest (review L15).
      await tx.$executeRaw`
        UPDATE conversations
        SET last_message_at = GREATEST(COALESCE(last_message_at, ${message.createdAt}), ${message.createdAt})
        WHERE id = ${id}::uuid`;
      // Writing counts as having read everything before it.
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId: id, userId: meId } },
        data: { lastReadAt: message.createdAt },
      });
      return message;
    });
    const message = this.toMessage(created);
    await this.events.emitAsync(
      MessageSentEvent.EVENT,
      new MessageSentEvent(message, memberIdsOf(row)),
    );
    return message;
  }

  /** Moves the caller's read mark to now; the others hear about it only when it actually moved. */
  async markRead(meId: string, id: string): Promise<MarkReadResult> {
    const row = await this.rowForMember(meId, id);
    const mine = row.members.find((member) => member.user.id === meId);
    // The newest message itself, not the denormalised stamp: under concurrent sends the two
    // can briefly disagree, and a mark "caught up" with the stamp would leave unread counts
    // behind (review L15).
    const newest = row.messages[0]?.createdAt ?? row.lastMessageAt;
    const caughtUp =
      newest === null ||
      (mine?.lastReadAt !== null && mine?.lastReadAt !== undefined && mine.lastReadAt >= newest);
    if (caughtUp) return { readAt: (mine?.lastReadAt ?? new Date()).toISOString() };

    const readAt = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: meId } },
      data: { lastReadAt: readAt },
    });
    await this.events.emitAsync(
      ConversationReadEvent.EVENT,
      new ConversationReadEvent(
        id,
        meId,
        readAt,
        memberIdsOf(row).filter((userId) => userId !== meId),
      ),
    );
    return { readAt: readAt.toISOString() };
  }

  /** Any member can bring people into a group. */
  async addMembers(meId: string, id: string, input: AddMembersInput): Promise<Conversation> {
    const row = await this.groupForMember(meId, id);
    const wanted = await this.resolveMembers(meId, input.userIds, 'userIds');
    // The cap is checked and the rows are written under a lock on the group, so two
    // concurrent additions cannot both pass the count (review L16).
    const added = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM conversations WHERE id = ${id}::uuid FOR UPDATE`;
      const members = await tx.conversationMember.findMany({
        where: { conversationId: id },
        select: { userId: true },
      });
      const current = new Set(members.map((member) => member.userId));
      const toAdd = wanted.filter((userId) => !current.has(userId));
      if (current.size + toAdd.length > GROUP_MAX_MEMBERS) {
        throw badRequest(`A group can have at most ${GROUP_MAX_MEMBERS} members`, {
          userIds: `At most ${GROUP_MAX_MEMBERS} members`,
        });
      }
      if (toAdd.length > 0) {
        await tx.conversationMember.createMany({
          data: toAdd.map((userId) => ({ conversationId: id, userId })),
          skipDuplicates: true,
        });
      }
      return toAdd.length;
    });
    if (added === 0) return this.withUnreadOne(row, meId);
    const updated = await this.rowForMember(meId, id);
    await this.events.emitAsync(
      ConversationUpdatedEvent.EVENT,
      new ConversationUpdatedEvent(id, memberIdsOf(updated)),
    );
    return this.withUnreadOne(updated, meId);
  }

  /** Leaving the last seat deletes the group and its messages. */
  async leave(meId: string, id: string): Promise<void> {
    const row = await this.groupForMember(meId, id);
    const remaining = memberIdsOf(row).filter((userId) => userId !== meId);
    if (remaining.length === 0) {
      await this.prisma.conversation.delete({ where: { id } });
    } else {
      await this.prisma.conversationMember.delete({
        where: { conversationId_userId: { conversationId: id, userId: meId } },
      });
    }
    await this.events.emitAsync(
      ConversationLeftEvent.EVENT,
      new ConversationLeftEvent(id, meId, remaining),
    );
  }

  /** The other members, or nobody when the caller is not one: for relays that must not throw. */
  async otherMemberIds(meId: string, id: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: id },
      select: { userId: true },
    });
    const ids = members.map((member) => member.userId);
    return ids.includes(meId) ? ids.filter((userId) => userId !== meId) : [];
  }

  private async rowForMember(meId: string, id: string): Promise<ConversationRow> {
    const row = await this.prisma.conversation.findFirst({
      where: { id, members: { some: { userId: meId } } },
      select: conversationSelect,
    });
    if (!row) throw notFound('Conversation not found');
    return row;
  }

  private async groupForMember(meId: string, id: string): Promise<ConversationRow> {
    const row = await this.rowForMember(meId, id);
    if (row.kind !== 'group') throw badRequest('Only groups have a member list');
    return row;
  }

  /** Deduplicated, without the caller, every id a real person. */
  private async resolveMembers(meId: string, ids: readonly string[], field: string) {
    const unique = [...new Set(ids)].filter((userId) => userId !== meId);
    if (unique.length === 0) {
      throw badRequest('Pick at least one other person', {
        [field]: 'Pick at least one other person',
      });
    }
    const found = await this.prisma.user.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      throw badRequest('Unknown member', { [field]: 'Someone on the list does not exist' });
    }
    return unique;
  }

  private async withUnreadOne(row: ConversationRow, meId: string): Promise<Conversation> {
    const [conversation] = await this.withUnread([row], meId);
    if (!conversation) throw notFound('Conversation not found');
    return conversation;
  }

  /** Messages from others newer than the viewer's read mark, one query for the whole page. */
  private async withUnread(rows: ConversationRow[], meId: string): Promise<Conversation[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => Prisma.sql`${row.id}::uuid`);
    const counts = await this.prisma.$queryRaw<UnreadRow[]>(Prisma.sql`
      SELECT m.conversation_id, COUNT(*)::int AS unread
      FROM "messages" m
      JOIN "conversation_members" cm
        ON cm.conversation_id = m.conversation_id AND cm.user_id = ${meId}::uuid
      WHERE m.conversation_id IN (${Prisma.join(ids)})
        AND m.sender_id <> ${meId}::uuid
        AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
      GROUP BY m.conversation_id
    `);
    const unreadById = new Map(counts.map((row) => [row.conversation_id, row.unread]));
    return rows.map((row) => toConversation(row, unreadById.get(row.id) ?? 0, this.assets.base));
  }

  private readonly toMessage = (row: MessageRow): Message => toMessage(row, this.assets.base);
}
