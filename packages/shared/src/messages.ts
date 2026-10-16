import { z } from 'zod';
import { apiErrorSchema } from './errors.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { messageImageKeySchema } from './uploads.js';
import { userSummarySchema } from './users.js';

export const MESSAGE_MAX_LENGTH = 2000;

export const messageSchema = z.object({
  id: z.uuid(),
  senderId: z.uuid(),
  recipientId: z.uuid(),
  /** Empty when the message is a picture only. */
  content: z.string(),
  imageUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export type Message = z.infer<typeof messageSchema>;

export const messageListSchema = paginatedSchema(messageSchema);
export type MessageList = z.infer<typeof messageListSchema>;

/** Text, a picture, or both; never neither. */
export const sendMessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(MESSAGE_MAX_LENGTH, `At most ${MESSAGE_MAX_LENGTH} characters`)
      .default(''),
    imageKey: messageImageKeySchema.optional(),
  })
  .refine((value) => value.content.length > 0 || value.imageKey !== undefined, {
    message: 'Write something or attach a picture',
    path: ['content'],
  });
export type SendMessageInput = z.input<typeof sendMessageSchema>;
export type SendMessageData = z.output<typeof sendMessageSchema>;

export const messagesQuerySchema = cursorQuerySchema;

/** One row per chat partner: the latest message and how many of theirs are unread. */
export const conversationSchema = z.object({
  peer: userSummarySchema,
  lastMessage: messageSchema,
  unreadCount: z.int().nonnegative(),
});
export type Conversation = z.infer<typeof conversationSchema>;

/** Same envelope as every list; `nextCursor` is null until conversations are paginated. */
export const conversationListSchema = paginatedSchema(conversationSchema);
export type ConversationList = z.infer<typeof conversationListSchema>;

export const markReadResultSchema = z.object({ count: z.int().nonnegative() });
export type MarkReadResult = z.infer<typeof markReadResultSchema>;

// --- socket.io contract ---------------------------------------------------

export const SOCKET_EVENTS = {
  /** server → client: the full list of online users (deduplicated per user). */
  presenceUpdate: 'presence:update',
  /** client → server with ack: SendMessagePayload → MessageAck. */
  messageSend: 'message:send',
  /** server → client (both parties): a persisted Message. */
  messageNew: 'message:new',
  /** client → server with ack: MarkReadPayload → MarkReadAck. */
  messageRead: 'message:read',
  /** server → client (the author): ConversationReadPayload – `userId` read your messages. */
  conversationRead: 'conversation:read',
  /** client → server, no ack: the sender started or stopped typing to `recipientId`. */
  typing: 'typing',
  /** server → client: TypingUpdate – `userId` started or stopped typing to you. */
  typingUpdate: 'typing:update',
  /** server → client: an ApiError raised by a handler outside the ack flow. */
  exception: 'exception',
} as const;

export const presenceUpdateSchema = z.array(userSummarySchema);
export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;

export const sendMessagePayloadSchema = sendMessageSchema.extend({ recipientId: z.uuid() });
export type SendMessagePayload = z.input<typeof sendMessagePayloadSchema>;

export const markReadPayloadSchema = z.object({ userId: z.uuid() });
export type MarkReadPayload = z.infer<typeof markReadPayloadSchema>;

export const messageAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), message: messageSchema }),
  z.object({ ok: z.literal(false), error: apiErrorSchema }),
]);
export type MessageAck = z.infer<typeof messageAckSchema>;

export const markReadAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), count: z.int().nonnegative() }),
  z.object({ ok: z.literal(false), error: apiErrorSchema }),
]);
export type MarkReadAck = z.infer<typeof markReadAckSchema>;

export const typingPayloadSchema = z.object({ recipientId: z.uuid(), typing: z.boolean() });
export type TypingPayload = z.infer<typeof typingPayloadSchema>;

/** Ephemeral: never stored, so a client treats a stale `typing: true` as over after a few seconds. */
export const typingUpdateSchema = z.object({ userId: z.uuid(), typing: z.boolean() });
export type TypingUpdate = z.infer<typeof typingUpdateSchema>;

export const conversationReadPayloadSchema = z.object({
  userId: z.uuid(),
  readAt: z.iso.datetime(),
});
export type ConversationReadPayload = z.infer<typeof conversationReadPayloadSchema>;

/** Typed event maps for socket.io on both ends. */
export type ServerToClientEvents = {
  [SOCKET_EVENTS.presenceUpdate]: (users: PresenceUpdate) => void;
  [SOCKET_EVENTS.messageNew]: (message: Message) => void;
  [SOCKET_EVENTS.conversationRead]: (payload: ConversationReadPayload) => void;
  [SOCKET_EVENTS.typingUpdate]: (payload: TypingUpdate) => void;
  [SOCKET_EVENTS.exception]: (error: z.infer<typeof apiErrorSchema>) => void;
};

export type ClientToServerEvents = {
  [SOCKET_EVENTS.messageSend]: (
    payload: SendMessagePayload,
    ack: (result: MessageAck) => void,
  ) => void;
  [SOCKET_EVENTS.messageRead]: (
    payload: MarkReadPayload,
    ack: (result: MarkReadAck) => void,
  ) => void;
  [SOCKET_EVENTS.typing]: (payload: TypingPayload) => void;
};
