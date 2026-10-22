import type { Message } from '@beso/shared';

/** A message was persisted; `memberIds` are everyone in the conversation, sender included. */
export class MessageSentEvent {
  static readonly EVENT = 'message.sent';
  constructor(
    readonly message: Message,
    readonly memberIds: readonly string[],
  ) {}
}

/** The sender deleted a message: `message` is its new state (content gone, `deletedAt` set). */
export class MessageDeletedEvent {
  static readonly EVENT = 'message.deleted';
  constructor(
    readonly message: Message,
    readonly memberIds: readonly string[],
  ) {}
}

/** The sender edited a message or someone reacted to it: `message` is its new state (ADR 0009 amendment 3). */
export class MessageUpdatedEvent {
  static readonly EVENT = 'message.updated';
  constructor(
    readonly message: Message,
    readonly memberIds: readonly string[],
    /** Who changed it: the sender for an edit, the reacting member for a reaction. */
    readonly actorId: string,
  ) {}
}

/** `readerId` caught up in a conversation; `memberIds` are every member, the reader's own tabs included. */
export class ConversationReadEvent {
  static readonly EVENT = 'conversation.read';
  constructor(
    readonly conversationId: string,
    readonly readerId: string,
    readonly readAt: Date,
    readonly memberIds: readonly string[],
  ) {}
}

/** A group was created, renamed, or its members or their roles changed; every current member should refetch it. */
export class ConversationUpdatedEvent {
  static readonly EVENT = 'conversation.updated';
  constructor(
    readonly conversationId: string,
    readonly memberIds: readonly string[],
  ) {}
}

/** A conversation ceased to exist for `memberIds` (a direct thread whose other side deleted their account). */
export class ConversationDeletedEvent {
  static readonly EVENT = 'conversation.deleted';
  constructor(
    readonly conversationId: string,
    readonly memberIds: readonly string[],
  ) {}
}

/** `userId` left a group; `memberIds` are those who remain (empty when the group is gone). */
export class ConversationLeftEvent {
  static readonly EVENT = 'conversation.left';
  constructor(
    readonly conversationId: string,
    readonly userId: string,
    readonly memberIds: readonly string[],
  ) {}
}

/** A member started a group (the `group_created` system line is written in the same go). */
export class GroupCreatedEvent {
  static readonly EVENT = 'group.created';
  constructor(
    readonly conversationId: string,
    readonly creatorId: string,
  ) {}
}
