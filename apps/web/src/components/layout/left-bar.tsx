import { cn } from 'cn';
import { NavLink } from 'react-router';
import { NAV_LINKS } from './nav-links';

type LeftBarProps = { className?: string; onNavigate?: () => void };

export function LeftBar({ className, onNavigate }: LeftBarProps) {
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
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
