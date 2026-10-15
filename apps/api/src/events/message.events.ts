import type { Message } from '@the-mesh/shared';

export class MessageSentEvent {
  static readonly EVENT = 'message.sent';
  constructor(readonly message: Message) {}
}

export class ConversationReadEvent {
  static readonly EVENT = 'conversation.read';
  constructor(
    readonly readerId: string,
    readonly peerId: string,
    readonly readAt: Date,
  ) {}
}
