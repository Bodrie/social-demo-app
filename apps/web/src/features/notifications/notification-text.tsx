import { NOTIFICATION_PHRASES, type Notification, notificationLink } from '@beso/shared';
import { Excerpt } from '@/features/activities/activity-text';
import { UserLink } from '@/components/user-link';

/**
 * One sentence per notification: the actor linked, the words from `NOTIFICATION_PHRASES` (the
 * push notification reads the same, ADR 0022) and the excerpt leading to the subject.
 */
export function NotificationText({ notification }: { notification: Notification }) {
  const { phrase, quotes } = NOTIFICATION_PHRASES[notification.type];
  const quoted = quotes === null ? null : notification[quotes];
  return (
    <>
      <UserLink user={notification.actor} /> {phrase}
      {quoted ? (
        <>
          : <Excerpt text={quoted.excerpt} to={notificationLink(notification)} />
        </>
      ) : null}
    </>
  );
}
