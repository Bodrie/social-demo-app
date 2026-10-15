/** All refresh tokens of a user were revoked (logout-all or reuse detection). */
export class SessionsRevokedEvent {
  static readonly EVENT = 'auth.sessionsRevoked';
  constructor(readonly userId: string) {}
}
