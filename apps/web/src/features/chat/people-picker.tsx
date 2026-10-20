import type { UserPublic } from '@beso/shared';
import { cn } from 'cn';
import { CheckIcon, SearchIcon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
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
  /** Rows are toggle buttons (`aria-pressed`) only in a multi-select picker. */
  multiple?: boolean;
  /** Left out of the results altogether (current members, for instance). */
  excludeIds?: readonly string[];
  onPick: (user: UserPublic) => void;
  searchLabel?: string;
  /** For `aria-controls` on a disclosure that reveals the picker. */
  id?: string;
  /** Focus the search box when the picker appears (a disclosure opened it). */
  focusOnMount?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
};

/** Search for members; a row calls `onPick`. The viewer is never offered. */
export function PeoplePicker({
  selectedIds = NONE,
  multiple = false,
  excludeIds = NONE,
  onPick,
  searchLabel = 'Search people',
  id,
  focusOnMount = false,
  inputRef,
}: PeoplePickerProps) {
  const me = useCurrentUser();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const setSearchRef = (element: HTMLInputElement | null) => {
    searchRef.current = element;
    if (inputRef) inputRef.current = element;
  };
  useEffect(() => {
    if (focusOnMount) searchRef.current?.focus();
  }, [focusOnMount]);
  const [input, setInput] = useState('');
  const q = useDebouncedValue(input.trim(), 250);
  const users = useUsers(q);
  const hidden = new Set([me.id, ...excludeIds]);
  const results = flattenPages(users.data)
    .filter((user) => !hidden.has(user.id))
    .slice(0, MAX_RESULTS);
  const status = users.isPending
    ? ''
    : results.length === 0
      ? 'No one found'
      : `${results.length} ${results.length === 1 ? 'person' : 'people'} found`;

  return (
    <div id={id} className="space-y-3">
      <div className="relative">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          ref={setSearchRef}
          type="search"
          aria-label={searchLabel}
          placeholder="Search by name or username"
          autoComplete="off"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="pl-9"
        />
      </div>
      {/* Results change silently otherwise; one short line keeps a screen reader informed. */}
      <output className="sr-only block">{status}</output>
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
                  aria-pressed={multiple ? selected : undefined}
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
