export class CommentCreatedEvent {
  static readonly EVENT = 'comment.created';
  constructor(
    readonly commentId: string,
    readonly postId: string,
    readonly authorId: string,
    readonly postAuthorId: string,
  ) {}
}
