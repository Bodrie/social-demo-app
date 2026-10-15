import { SearchIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { useUsers } from '@/features/users/use-users';
import { flattenPages } from '@/lib/infinite';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const MAX_RESULTS = 8;

/** Pick a person to write to; opens their thread. */
export function NewMessageDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Who do you want to write to?</DialogDescription>
        </DialogHeader>
        <PeoplePicker onPick={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PeoplePicker({ onPick }: { onPick: () => void }) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const q = useDebouncedValue(input.trim(), 250);
  const users = useUsers(q);
  const results = flattenPages(users.data)
    .filter((user) => user.id !== me.id)
    .slice(0, MAX_RESULTS);

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search people to message"
          placeholder="Search by name or username"
          autoComplete="off"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="pl-9"
        />
      </div>
      {users.isPending ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">No one found.</p>
      ) : (
        <ul aria-label="People" className="max-h-80 space-y-1 overflow-y-auto">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left"
                onClick={() => {
                  onPick();
                  void navigate(`/messages/${user.username}`);
                }}
              >
                <UserAvatar user={user} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{user.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    @{user.username}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
