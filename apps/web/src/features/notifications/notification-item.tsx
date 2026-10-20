import type { Notification } from '@beso/shared';
import { cn } from 'cn';
import { Link } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { NotificationText } from './notification-text';

type NotificationItemProps = { notification: Notification; className?: string };

/** One row; an unread one is tinted and carries a dot, as it was when the page loaded. */
export function NotificationItem({ notification, className }: NotificationItemProps) {
  const unread = notification.readAt === null;
  return (
    <li className={cn('flex gap-3', unread && 'bg-accent/50', className)}>
      <Link to={`/u/${notification.actor.username}`} aria-hidden="true" tabIndex={-1}>
        <UserAvatar user={notification.actor} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <p className="line-clamp-3 break-words">
          {unread ? <span className="sr-only">Unread: </span> : null}
          <NotificationText notification={notification} />
        </p>
        <time
          dateTime={notification.createdAt}
          title={formatDateTime(notification.createdAt)}
          className="text-muted-foreground text-xs"
        >
          {formatRelativeTime(notification.createdAt)}
          <span className="sr-only"> ({formatDateTime(notification.createdAt)})</span>
        </time>
      </div>
      {unread ? (
        <span aria-hidden="true" className="bg-primary mt-2 size-2 shrink-0 rounded-full" />
      ) : null}
    </li>
  );
}
