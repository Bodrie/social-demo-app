import { LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react';
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

  // Ending the session makes the RequireAuth route redirect to /login by itself.
  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => toast.success('Signed out') });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <UserAvatar user={user} className="size-8" />
          <span className="hidden max-w-40 truncate text-sm font-medium md:inline">
            {user.name}
          </span>
          <span className="sr-only">, account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{user.name}</span>
          <span className="text-muted-foreground truncate text-xs">@{user.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate(`/u/${user.username}`)}>
          <UserIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate('/settings')}>
          <SettingsIcon /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} disabled={logout.isPending}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
