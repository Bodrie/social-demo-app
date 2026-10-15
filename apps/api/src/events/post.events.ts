export class PostCreatedEvent {
  static readonly EVENT = 'post.created';
  constructor(
    readonly postId: string,
    readonly authorId: string,
  ) {}
}

export class PostLikedEvent {
  static readonly EVENT = 'post.liked';
  constructor(
    readonly postId: string,
    readonly actorId: string,
    readonly authorId: string,
  ) {}
}

export class PostUnlikedEvent {
  static readonly EVENT = 'post.unliked';
  constructor(
    readonly postId: string,
    readonly actorId: string,
  ) {}
}
