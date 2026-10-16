import type { UserPublic } from '@the-mesh/shared';
import { cn } from 'cn';
import { CheckIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { useUsers } from '@/features/users/use-users';
import { flattenPages } from '@/lib/infinite';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const MAX_RESULTS = 8;
const NONE: readonly string[] = [];

type PeoplePickerProps = {
  /** Shown as chosen (multi-select); the row toggles through `onPick`. */
  selectedIds?: readonly string[];
  /** Left out of the results altogether (current members, for instance). */
  excludeIds?: readonly string[];
  onPick: (user: UserPublic) => void;
  searchLabel?: string;
};

/** Search for members; a row calls `onPick`. The viewer is never offered. */
export function PeoplePicker({
  selectedIds = NONE,
  excludeIds = NONE,
  onPick,
  searchLabel = 'Search people',
}: PeoplePickerProps) {
  const me = useCurrentUser();
  const [input, setInput] = useState('');
  const q = useDebouncedValue(input.trim(), 250);
  const users = useUsers(q);
  const hidden = new Set([me.id, ...excludeIds]);
  const results = flattenPages(users.data)
    .filter((user) => !hidden.has(user.id))
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
          aria-label={searchLabel}
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
        <ul aria-label="People" className="max-h-72 space-y-1 overflow-y-auto">
          {results.map((user) => {
            const selected = selectedIds.includes(user.id);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  aria-pressed={selectedIds.length > 0 || selected ? selected : undefined}
                  className={cn(
                    'hover:bg-muted flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left',
                    selected && 'bg-accent/60',
                  )}
                  onClick={() => onPick(user)}
                >
                  <UserAvatar user={user} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{user.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      @{user.username}
                    </span>
                  </span>
                  {selected ? (
                    <CheckIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
