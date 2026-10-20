import { USER_SEARCH_MAX_LENGTH } from '@beso/shared';
import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageTitle } from '@/lib/use-page-title';
import { SuggestionsCard } from './suggestions-card';
import { UserList } from './user-list';
import { useUsers } from './use-users';

export function UsersPage() {
  usePageTitle('People');
  const [params, setParams] = useSearchParams();
  // The box owns the text; the URL mirrors the settled query so searches can be shared.
  const [input, setInput] = useState((params.get('q') ?? '').slice(0, USER_SEARCH_MAX_LENGTH));
  const q = useDebouncedValue(input.trim(), 300);
  const query = useUsers(q);

  useEffect(() => {
    setParams(q ? { q } : {}, { replace: true });
  }, [q, setParams]);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">People</h1>
        <p className="text-muted-foreground text-sm">Find members by name or username.</p>
        <div className="relative mt-3">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search people"
            placeholder="Search by name or username"
            autoComplete="off"
            maxLength={USER_SEARCH_MAX_LENGTH}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="pr-9 pl-9"
          />
          {input ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
              onClick={() => setInput('')}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      </div>

      {q ? null : <SuggestionsCard className="xl:hidden" />}

      <UserList
        query={query}
        label={q ? `Results for ${q}` : 'People'}
        errorMessage="Could not load people."
        empty={
          q
            ? {
                title: `No one matches “${q}”`,
                description: 'Try another spelling or a shorter query.',
              }
            : { title: 'No people yet' }
        }
      />
    </div>
  );
}
