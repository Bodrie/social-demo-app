import { z } from 'zod';
import { apiErrorSchema } from './errors.js';
import { uuidSchema } from './common.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { messageImageKeySchema } from './uploads.js';
import { userSummarySchema } from './users.js';

export const MESSAGE_MAX_LENGTH = 2000;
export const GROUP_TITLE_MAX_LENGTH = 60;
/** Members per group, the creator included. */
export const GROUP_MAX_MEMBERS = 50;

export const CONVERSATION_KINDS = ['direct', 'group'] as const;
export const conversationKindSchema = z.enum(CONVERSATION_KINDS);
export type ConversationKind = z.infer<typeof conversationKindSchema>;

/** Group admins rename, remove people and hand the role on; every member adds people and leaves. */
export const CONVERSATION_ROLES = ['admin', 'member'] as const;
export const conversationRoleSchema = z.enum(CONVERSATION_ROLES);
export type ConversationRole = z.infer<typeof conversationRoleSchema>;

export const MESSAGE_KINDS = ['user', 'system'] as const;
export const messageKindSchema = z.enum(MESSAGE_KINDS);
export type MessageKind = z.infer<typeof messageKindSchema>;

/** What a system line is about: who joined, who left or was removed, the new name. */
export const SYSTEM_LINE_TYPES = [
  'members_added',
  'member_left',
  'member_removed',
  'renamed',
] as const;
const personRefSchema = z.object({ id: z.uuid(), name: z.string() });
export const systemLineSchema = z.object({
  type: z.enum(SYSTEM_LINE_TYPES),
  /** Who did it, named as at the time (a client prefers the current name of someone still in). */
  actor: personRefSchema,
  /** The people concerned (added or removed); empty for a rename. */
  users: z.array(personRefSchema),
  /** The new title of a rename, null otherwise. */
  title: z.string().nullable(),
});
export type SystemLine = z.infer<typeof systemLineSchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  senderId: z.uuid(),
  /** `system` lines are written by the server about membership changes and renames. */
  kind: messageKindSchema,
  /** Empty when the message is a picture only, a system line or deleted. */
  content: z.string(),
  imageUrl: z.url().nullable(),
  /** Set once the sender deleted it: the row stays (ordering, read marks), its content is gone. */
  deletedAt: z.iso.datetime().nullable(),
  /** The subject of a system line; null on a user's message. */
  system: systemLineSchema.nullable(),
  createdAt: z.iso.datetime(),
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
/** The list is keyset-paginated by activity (`lastMessageAt`, else `createdAt`), newest first. */
export const conversationsQuerySchema = cursorQuerySchema;

/** Read state lives on the membership: everything up to `lastReadAt` has been seen. */
export const conversationMemberSchema = z.object({
  user: userSummarySchema,
  role: conversationRoleSchema,
  joinedAt: z.iso.datetime(),
  lastReadAt: z.iso.datetime().nullable(),
});
export type ConversationMember = z.infer<typeof conversationMemberSchema>;

/**
 * A direct conversation is the one thread between two people (no title); a group has a
 * title and any number of members. `members` always includes the viewer.
 */
export const conversationSchema = z.object({
  id: z.uuid(),
  kind: conversationKindSchema,
  title: z.string().nullable(),
  createdById: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  lastMessageAt: z.iso.datetime().nullable(),
  members: z.array(conversationMemberSchema),
  lastMessage: messageSchema.nullable(),
  unreadCount: z.int().nonnegative(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const conversationListSchema = paginatedSchema(conversationSchema);
export type ConversationList = z.infer<typeof conversationListSchema>;

const memberIdsSchema = z
  .array(uuidSchema)
  .min(1, 'Pick at least one person')
  .max(GROUP_MAX_MEMBERS - 1, `At most ${GROUP_MAX_MEMBERS} members`);

const groupTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the group a name')
  .max(GROUP_TITLE_MAX_LENGTH, `At most ${GROUP_TITLE_MAX_LENGTH} characters`);

export const createGroupSchema = z.object({
  title: groupTitleSchema,
  /** The other members; the creator is added by the server (as its admin). */
  memberIds: memberIdsSchema,
});
export type CreateGroupInput = z.input<typeof createGroupSchema>;

export const addMembersSchema = z.object({ userIds: memberIdsSchema });
export type AddMembersInput = z.input<typeof addMembersSchema>;

/** Admins only. */
export const renameGroupSchema = z.object({ title: groupTitleSchema });
export type RenameGroupInput = z.input<typeof renameGroupSchema>;

/** Admins only; demoting the last admin is refused. */
export const setMemberRoleSchema = z.object({ role: conversationRoleSchema });
export type SetMemberRoleInput = z.infer<typeof setMemberRoleSchema>;

export const markReadResultSchema = z.object({ readAt: z.iso.datetime() });
export type MarkReadResult = z.infer<typeof markReadResultSchema>;

// --- socket.io contract ---------------------------------------------------

export const SOCKET_EVENTS = {
  /** server → client: the full list of online users (deduplicated per user). */
  presenceUpdate: 'presence:update',
  /** client → server with ack: SendMessagePayload → MessageAck. */
  messageSend: 'message:send',
  /** server → client (every member): a persisted Message (a system line included). */
  messageNew: 'message:new',
  /** server → client (every member): the Message as it is now, `deletedAt` set and content gone. */
  messageDeleted: 'message:deleted',
  /** client → server with ack: MarkReadPayload → MarkReadAck. */
  messageRead: 'message:read',
  /** server → client (the other members): ConversationReadPayload – `userId` caught up. */
  conversationRead: 'conversation:read',
  /** server → client (every member): the conversation was created or its members changed; fetch it. */
  conversationUpdate: 'conversation:update',
  /** server → client (the member who left): forget this conversation. */
  conversationRemoved: 'conversation:removed',
  /** client → server, no ack: the sender started or stopped typing in `conversationId`. */
  typing: 'typing',
  /** server → client (the other members): TypingUpdate. */
  typingUpdate: 'typing:update',
  /** server → client: an ApiError raised by a handler outside the ack flow. */
  exception: 'exception',
} as const;

export const presenceUpdateSchema = z.array(userSummarySchema);
export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;

export const sendMessagePayloadSchema = sendMessageSchema.extend({ conversationId: uuidSchema });
export type SendMessagePayload = z.input<typeof sendMessagePayloadSchema>;

export const markReadPayloadSchema = z.object({ conversationId: uuidSchema });
export type MarkReadPayload = z.infer<typeof markReadPayloadSchema>;

export const messageAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), message: messageSchema }),
  z.object({ ok: z.literal(false), error: apiErrorSchema }),
]);
export type MessageAck = z.infer<typeof messageAckSchema>;

export const markReadAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), readAt: z.iso.datetime() }),
  z.object({ ok: z.literal(false), error: apiErrorSchema }),
]);
export type MarkReadAck = z.infer<typeof markReadAckSchema>;

export const typingPayloadSchema = z.object({ conversationId: uuidSchema, typing: z.boolean() });
export type TypingPayload = z.infer<typeof typingPayloadSchema>;

/** Ephemeral: never stored, so a client treats a stale `typing: true` as over after a few seconds. */
export const typingUpdateSchema = z.object({
  conversationId: z.uuid(),
  userId: z.uuid(),
  typing: z.boolean(),
});
export type TypingUpdate = z.infer<typeof typingUpdateSchema>;

export const conversationReadPayloadSchema = z.object({
  conversationId: z.uuid(),
  userId: z.uuid(),
  readAt: z.iso.datetime(),
});
export type ConversationReadPayload = z.infer<typeof conversationReadPayloadSchema>;

export const conversationRefSchema = z.object({ conversationId: z.uuid() });
export type ConversationRef = z.infer<typeof conversationRefSchema>;

/** Typed event maps for socket.io on both ends. */
export type ServerToClientEvents = {
  [SOCKET_EVENTS.presenceUpdate]: (users: PresenceUpdate) => void;
  [SOCKET_EVENTS.messageNew]: (message: Message) => void;
  [SOCKET_EVENTS.messageDeleted]: (message: Message) => void;
  [SOCKET_EVENTS.conversationRead]: (payload: ConversationReadPayload) => void;
  [SOCKET_EVENTS.conversationUpdate]: (payload: ConversationRef) => void;
  [SOCKET_EVENTS.conversationRemoved]: (payload: ConversationRef) => void;
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
