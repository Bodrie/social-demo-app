/** Domain events about members (users, follows, mentions); names are `<entity>.<past tense>`. */
export class UserRegisteredEvent {
  static readonly EVENT = 'user.registered';
  constructor(readonly userId: string) {}
}

export class ProfileUpdatedEvent {
  static readonly EVENT = 'profile.updated';
  constructor(
    readonly userId: string,
    readonly changedFields: string[],
  ) {}
}

export class UserFollowedEvent {
  static readonly EVENT = 'user.followed';
  constructor(
    readonly followerId: string,
    readonly followeeId: string,
  ) {}
}

export class UserUnfollowedEvent {
  static readonly EVENT = 'user.unfollowed';
  constructor(
    readonly followerId: string,
    readonly followeeId: string,
  ) {}
}

/** `actorId` mentioned `targetUserId` in a post (`commentId` null) or a comment; emitted once per new mention. */
export class UserMentionedEvent {
  static readonly EVENT = 'user.mentioned';
  constructor(
    readonly actorId: string,
    readonly targetUserId: string,
    readonly postId: string,
    readonly commentId: string | null,
  ) {}
}
