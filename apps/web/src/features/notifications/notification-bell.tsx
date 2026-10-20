import { BellIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUnreadNotifications } from './use-notifications';

/** The header's way to the notifications page, with the unread count on it. */
export function NotificationBell() {
  const unread = useUnreadNotifications();
  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link
        to="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <BellIcon aria-hidden="true" />
        {unread > 0 ? (
          <Badge
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none tabular-nums"
          >
            {unread > 99 ? '99+' : unread}
          </Badge>
        ) : null}
      </Link>
    </Button>
  );
}
