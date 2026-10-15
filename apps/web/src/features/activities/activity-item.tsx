import type { Activity } from '@the-mesh/shared';
import { cn } from 'cn';
import { Link } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { ActivityText } from './activity-text';

type ActivityItemProps = { activity: Activity; className?: string };

export function ActivityItem({ activity, className }: ActivityItemProps) {
  return (
    <li className={cn('flex gap-3', className)}>
      <Link to={`/u/${activity.actor.username}`} aria-hidden="true" tabIndex={-1}>
        <UserAvatar user={activity.actor} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <p className="line-clamp-3 break-words">
          <ActivityText activity={activity} />
        </p>
        <time
          dateTime={activity.createdAt}
          title={formatDateTime(activity.createdAt)}
          className="text-muted-foreground text-xs"
        >
          {formatRelativeTime(activity.createdAt)}
        </time>
      </div>
    </li>
  );
}
