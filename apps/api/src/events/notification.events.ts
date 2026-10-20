import type { Notification } from '@beso/shared';

/** A notification was written (or refreshed) for `userId`; the gateway pushes it to their sockets. */
export class NotificationCreatedEvent {
  static readonly EVENT = 'notification.created';
  constructor(
    readonly userId: string,
    readonly notification: Notification,
  ) {}
}
