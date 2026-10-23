import { NOTIFICATION_PHRASES, type Notification, notificationLink } from '@beso/shared';
import { achievementSentence } from '@beso/shared/achievements';
import { Link } from 'react-router';
import { Excerpt } from '@/features/activities/activity-text';
import { UserLink } from '@/components/user-link';

/**
 * One sentence per notification: the actor linked, the words from `NOTIFICATION_PHRASES` (the
 * push notification reads the same, ADR 0022) and the excerpt leading to the subject. A badge
 * has no actor: its sentence names the badge and leads to the member's Badges tab. The end of
 * the member's own poll has none either: its `own` words, then the poll's excerpt.
 */
export function NotificationText({ notification }: { notification: Notification }) {
  if (notification.type === 'ACHIEVEMENT_EARNED') {
    return (
      <Link to={notificationLink(notification)} className="hover:underline">
        {achievementSentence(notification.achievementKey)}
      </Link>
    );
  }
  const { phrase, quotes, own } = NOTIFICATION_PHRASES[notification.type];
  const quoted = quotes === null ? null : notification[quotes];
  return (
    <>
      {notification.actor ? (
        <>
          <UserLink user={notification.actor} /> {phrase}
        </>
      ) : (
        (own ?? phrase)
      )}
      {quoted ? (
        <>
          : <Excerpt text={quoted.excerpt} to={notificationLink(notification)} />
        </>
      ) : null}
    </>
  );
}
