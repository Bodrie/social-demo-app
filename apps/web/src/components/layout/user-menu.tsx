import {
  BookmarkIcon,
  LogOutIcon,
  ScaleIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/features/auth/use-auth-mutations';
import { useCurrentUser } from '@/features/auth/current-user';

export function UserMenu() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const logout = useLogout();
  // After choosing a page, focus belongs to that page (AppShell moves it to <main>), not back
  // on this button as Radix would do by default.
  const navigated = useRef(false);
  const go = (to: string) => {
    navigated.current = true;
    void navigate(to);
  };

  // Ending the session makes the RequireAuth route redirect to /login by itself.
  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => toast.success('Signed out') });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label={`${user.name}, account menu`}>
          <UserAvatar user={user} className="size-8" />
          <span
            className="hidden max-w-40 truncate text-sm font-medium md:inline"
            aria-hidden="true"
          >
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onCloseAutoFocus={(event) => {
          if (navigated.current) event.preventDefault();
          navigated.current = false;
        }}
      >
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{user.name}</span>
          <span className="text-muted-foreground truncate text-xs">@{user.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go(`/u/${user.username}`)}>
          <UserIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go('/bookmarks')}>
          <BookmarkIcon /> Bookmarks
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go('/settings')}>
          <SettingsIcon /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go('/privacy')}>
          <ScaleIcon /> Privacy and terms
        </DropdownMenuItem>
        {user.role === 'admin' ? (
          <DropdownMenuItem onSelect={() => go('/admin')}>
            <ShieldCheckIcon /> Admin
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} disabled={logout.isPending}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
