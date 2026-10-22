/** Domain events about members (users, follows, mentions); names are `<entity>.<past tense>`. */
export class UserRegisteredEvent {
  static readonly EVENT = 'user.registered';
  constructor(readonly userId: string) {}
}

/**
 * The member's address was confirmed for the first time, so the account is open (by the mailed
 * link, a password reset, or confirming a corrected address from the waiting room).
 */
export class UserVerifiedEvent {
  static readonly EVENT = 'user.verified';
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
    /** The new member following whoever invited them (F1): told as INVITE_JOINED instead. */
    readonly viaInvite = false,
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
