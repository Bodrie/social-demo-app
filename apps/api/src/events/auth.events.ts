/**
 * Every session of a member ended (sign out everywhere, password reset, reuse detection,
 * suspension, account deletion): the gateway closes their sockets.
 */
export class SessionsRevokedEvent {
  static readonly EVENT = 'sessions.revoked';
  constructor(readonly userId: string) {}
}
