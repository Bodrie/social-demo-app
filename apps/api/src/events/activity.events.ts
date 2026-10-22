import type { Activity } from '@beso/shared';

/**
 * An activity was recorded; the gateway pushes it to `recipientIds`, the actor's followers
 * who may see it (C7).
 */
export class ActivityRecordedEvent {
  static readonly EVENT = 'activity.recorded';
  constructor(
    readonly activity: Activity,
    readonly recipientIds: string[],
  ) {}
}
