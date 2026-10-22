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

/** A plain repost by `actorId` of `authorId`'s post (ADR 0017); emitted once per repost. */
export class PostRepostedEvent {
  static readonly EVENT = 'post.reposted';
  constructor(
    readonly postId: string,
    readonly actorId: string,
    readonly authorId: string,
  ) {}
}

export class PostUnrepostedEvent {
  static readonly EVENT = 'post.unreposted';
  constructor(
    readonly postId: string,
    readonly actorId: string,
  ) {}
}

/** `actorId` published `quoteId`, a post of their own that embeds `originalId` by `originalAuthorId`. */
export class PostQuotedEvent {
  static readonly EVENT = 'post.quoted';
  constructor(
    readonly quoteId: string,
    readonly originalId: string,
    readonly actorId: string,
    readonly originalAuthorId: string,
  ) {}
}

/** A member saved a post for later (C3a); only the first save of a post emits it. */
export class PostBookmarkedEvent {
  static readonly EVENT = 'post.bookmarked';
  constructor(
    readonly postId: string,
    readonly userId: string,
  ) {}
}
