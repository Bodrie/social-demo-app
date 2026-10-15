import type { Message } from '@the-mesh/shared';
import type { Prisma } from '../generated/prisma/client.js';

export const messageSelect = {
  id: true,
  senderId: true,
  recipientId: true,
  content: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.MessageSelect;

export type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}
