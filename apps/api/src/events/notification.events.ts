import type { Notification } from '@the-mesh/shared';

/** A notification was written (or refreshed) for `userId`; the gateway pushes it to their sockets. */
export class NotificationCreatedEvent {
  static readonly EVENT = 'notification.created';
  constructor(
    readonly userId: string,
    readonly notification: Notification,
  ) {}
}
