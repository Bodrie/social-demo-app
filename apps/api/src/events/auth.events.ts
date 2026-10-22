/**
 * Every session of a member ended (sign out everywhere, password reset, reuse detection,
 * suspension, account deletion): the gateway closes their sockets.
 */
export class SessionsRevokedEvent {
  static readonly EVENT = 'sessions.revoked';
  constructor(readonly userId: string) {}
}

/**
 * Some of a member's sessions ended (a sign-out, "sign out this device", a password change,
 * and everything `SessionsRevokedEvent` stands for): what belonged to them goes as well, such
 * as the push subscriptions made under them (ADR 0022). Sockets are not cut for this.
 */
export class SessionsEndedEvent {
  static readonly EVENT = 'sessions.ended';
  constructor(readonly userId: string) {}
}
