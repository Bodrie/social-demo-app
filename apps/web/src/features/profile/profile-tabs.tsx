import { cn } from 'cn';
import { NavLink } from 'react-router';

const TABS = [
  { to: '.', label: 'Posts', end: true },
  { to: 'followers', label: 'Followers', end: false },
  { to: 'following', label: 'Following', end: false },
];

export function ProfileTabs() {
  return (
    <nav
      aria-label="Profile sections"
      className="bg-card flex rounded-xl border p-1 text-sm font-medium"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'flex-1 rounded-lg px-3 py-2 text-center transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
