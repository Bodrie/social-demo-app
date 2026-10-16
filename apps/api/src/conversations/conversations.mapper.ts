import type { Conversation, Message } from '@the-mesh/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

export const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  imageKey: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

export type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export function toMessage(row: MessageRow, assetsBase: string): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.content,
    imageUrl: row.imageKey === null ? null : `${assetsBase}/${row.imageKey}`,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A conversation with its members and newest message; the unread count is added per viewer. */
export const conversationSelect = {
  id: true,
  kind: true,
  title: true,
  createdById: true,
  createdAt: true,
  lastMessageAt: true,
  members: {
    select: { joinedAt: true, lastReadAt: true, user: { select: userSummarySelect } },
    orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
  },
  messages: {
    select: messageSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} satisfies Prisma.ConversationSelect;

export type ConversationRow = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>;

export const memberIdsOf = (row: ConversationRow): string[] =>
  row.members.map((member) => member.user.id);

export function toConversation(
  row: ConversationRow,
  unreadCount: number,
  assetsBase: string,
): Conversation {
  const latest = row.messages[0];
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    members: row.members.map((member) => ({
      user: toUserSummary(member.user, assetsBase),
      joinedAt: member.joinedAt.toISOString(),
      lastReadAt: member.lastReadAt ? member.lastReadAt.toISOString() : null,
    })),
    lastMessage: latest ? toMessage(latest, assetsBase) : null,
    unreadCount,
  };
}

/** The unique key of the direct conversation between two people, whichever order they come in. */
export const directKeyOf = (a: string, b: string): string => [a, b].toSorted().join(':');
