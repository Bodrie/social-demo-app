/** A reply carries the top-level comment it sits under and that comment's author (C2). */
export class CommentCreatedEvent {
  static readonly EVENT = 'comment.created';
  constructor(
    readonly commentId: string,
    readonly postId: string,
    readonly authorId: string,
    readonly postAuthorId: string,
    readonly parentId: string | null = null,
    readonly parentAuthorId: string | null = null,
  ) {}
}

/**
 * `actorId` put a reaction on a comment, or switched to another emoji. `first` is true when the
 * comment had none from them: only that one is told to the author (notifications).
 */
export class CommentReactedEvent {
  static readonly EVENT = 'comment.reacted';
  constructor(
    readonly commentId: string,
    readonly postId: string,
    readonly actorId: string,
    readonly commentAuthorId: string,
    readonly first = true,
  ) {}
}
