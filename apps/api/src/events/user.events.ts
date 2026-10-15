/** Domain events emitted by the users/auth services. Listeners arrive with the activities slice. */
export class UserRegisteredEvent {
  static readonly EVENT = 'user.registered';
  constructor(readonly userId: string) {}
}

export class ProfileUpdatedEvent {
  static readonly EVENT = 'user.profileUpdated';
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
