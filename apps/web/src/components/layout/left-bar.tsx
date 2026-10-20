import { cn } from 'cn';
import { NavLink } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { useUnreadCount } from '@/features/chat/use-conversations';
import { useUnreadNotifications } from '@/features/notifications/use-notifications';
import { NAV_LINKS } from './nav-links';

type LeftBarProps = { className?: string; onNavigate?: () => void };

export function LeftBar({ className, onNavigate }: LeftBarProps) {
  const badges: Record<string, number> = {
    '/messages': useUnreadCount(),
    '/notifications': useUnreadNotifications(),
  };
  return (
    <nav aria-label="Main" className={cn('flex flex-col gap-1', className)}>
      {NAV_LINKS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-5" aria-hidden="true" />
          {label}
          {(badges[to] ?? 0) > 0 ? (
            <>
              {' '}
              <Badge className="ml-auto h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                <span aria-hidden="true">{(badges[to] ?? 0) > 99 ? '99+' : badges[to]}</span>
                <span className="sr-only">{badges[to]} unread</span>
              </Badge>
            </>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
