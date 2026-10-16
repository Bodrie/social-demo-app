import type { Message } from '@the-mesh/shared';

/** A message was persisted; `memberIds` are everyone in the conversation, sender included. */
export class MessageSentEvent {
  static readonly EVENT = 'message.sent';
  constructor(
    readonly message: Message,
    readonly memberIds: readonly string[],
  ) {}
}

/** `readerId` caught up in a conversation; `memberIds` are the others, who show the receipt. */
export class ConversationReadEvent {
  static readonly EVENT = 'conversation.read';
  constructor(
    readonly conversationId: string,
    readonly readerId: string,
    readonly readAt: Date,
    readonly memberIds: readonly string[],
  ) {}
}

/** A group was created or gained members; every current member should refetch it. */
export class ConversationUpdatedEvent {
  static readonly EVENT = 'conversation.updated';
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
