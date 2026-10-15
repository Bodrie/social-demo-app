import { z } from 'zod';
import { apiErrorSchema } from './errors.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { postAuthorSchema } from './posts.js';

export const MESSAGE_MAX_LENGTH = 2000;

export const messageSchema = z.object({
  id: z.uuid(),
  senderId: z.uuid(),
  recipientId: z.uuid(),
  content: z.string(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export type Message = z.infer<typeof messageSchema>;

export const messageListSchema = paginatedSchema(messageSchema);
export type MessageList = z.infer<typeof messageListSchema>;

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write something first')
    .max(MESSAGE_MAX_LENGTH, `At most ${MESSAGE_MAX_LENGTH} characters`),
});
export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type SendMessageData = z.output<typeof sendMessageSchema>;

export const messagesQuerySchema = cursorQuerySchema;

/** One row per chat partner: the latest message and how many of theirs are unread. */
export const conversationSchema = z.object({
  peer: postAuthorSchema,
  lastMessage: messageSchema,
  unreadCount: z.int().nonnegative(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const markReadResultSchema = z.object({ count: z.int().nonnegative() });

// --- socket.io contract ---------------------------------------------------

export const SOCKET_EVENTS = {
  /** server → client: the full list of online users (deduplicated per user). */
  presenceUpdate: 'presence:update',
  /** client → server with ack: { recipientId, content } → MessageAck. */
  messageSend: 'message:send',
  /** server → client (both parties): a persisted Message. */
  messageNew: 'message:new',
  /** client → server with ack: { userId } marks that user's messages to me as read. */
  messageRead: 'message:read',
  /** server → client (the author): { userId, readAt } – `userId` read your messages. */
  conversationRead: 'conversation:read',
} as const;

export const presenceUpdateSchema = z.array(postAuthorSchema);
export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;

export const sendMessageEventSchema = sendMessageSchema.extend({ recipientId: z.uuid() });
export type SendMessageEvent = z.input<typeof sendMessageEventSchema>;

export const markReadEventSchema = z.object({ userId: z.uuid() });
export type MarkReadEvent = z.infer<typeof markReadEventSchema>;

export const messageAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), message: messageSchema }),
  z.object({ ok: z.literal(false), error: apiErrorSchema }),
]);
export type MessageAck = z.infer<typeof messageAckSchema>;

export const conversationReadEventSchema = z.object({ userId: z.uuid(), readAt: z.iso.datetime() });
export type ConversationReadEvent = z.infer<typeof conversationReadEventSchema>;
