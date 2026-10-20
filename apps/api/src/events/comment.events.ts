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

/** `actorId` put a reaction on a comment that had none from them; switching the emoji is not one. */
export class CommentReactedEvent {
  static readonly EVENT = 'comment.reacted';
  constructor(
    readonly commentId: string,
    readonly postId: string,
    readonly actorId: string,
    readonly commentAuthorId: string,
  ) {}
}
