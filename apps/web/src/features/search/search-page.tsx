import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, hashtagSchema } from '@beso/shared';
import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostList } from '@/features/posts/post-list';
import { useSearchPosts } from '@/features/posts/use-posts';
import { UserList } from '@/features/users/user-list';
import { useUsers } from '@/features/users/use-users';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageTitle } from '@/lib/use-page-title';

type SearchType = 'posts' | 'people';

const TAB_CLASS = 'text-muted-foreground data-[state=active]:text-foreground';

/** `/search?q=&type=`: posts by full text, people by name or username. */
export function SearchPage() {
  usePageTitle('Search');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type: SearchType = params.get('type') === 'people' ? 'people' : 'posts';
  // The box owns the text; the URL mirrors the settled query so searches can be shared.
  const [input, setInput] = useState((params.get('q') ?? '').slice(0, SEARCH_MAX_LENGTH));
  const q = useDebouncedValue(input.trim(), 300);

  useEffect(() => {
    setParams(
      (previous) => {
        if (q) previous.set('q', q);
        else previous.delete('q');
        return previous;
      },
      { replace: true },
    );
  }, [q, setParams]);

  // A `#tag` has its own page.
  useEffect(() => {
    if (!q.startsWith('#')) return;
    const tag = hashtagSchema.safeParse(q);
    if (tag.success) void navigate(`/tags/${encodeURIComponent(tag.data)}`, { replace: true });
  }, [q, navigate]);

  const setType = (next: string) =>
    setParams(
      (previous) => {
        previous.set('type', next);
        return previous;
      },
      { replace: true },
    );

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">Search</h1>
        <p className="text-muted-foreground text-sm">
          Posts by their words, people by name or username. Quotes keep a phrase together,{' '}
          <code className="text-xs">-word</code> leaves posts out.
        </p>
        <div className="relative mt-3">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search posts and people"
            placeholder="What are you looking for?"
            autoComplete="off"
            maxLength={SEARCH_MAX_LENGTH}
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

      <Tabs value={type} onValueChange={setType}>
        <TabsList aria-label="What to search">
          {/* The primitive's inactive tint (60 % foreground) misses the contrast ratio; the token passes. */}
          <TabsTrigger value="posts" className={TAB_CLASS}>
            Posts
          </TabsTrigger>
          <TabsTrigger value="people" className={TAB_CLASS}>
            People
          </TabsTrigger>
        </TabsList>
        <TabsContent value="posts">
          {q.length >= SEARCH_MIN_LENGTH ? (
            <PostResults q={q} />
          ) : (
            <Hint text={`Type at least ${SEARCH_MIN_LENGTH} characters to search posts.`} />
          )}
        </TabsContent>
        <TabsContent value="people">
          {q ? <PeopleResults q={q} /> : <Hint text="Type a name or a username." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PostResults({ q }: { q: string }) {
  return (
    <PostList
      query={useSearchPosts(q)}
      label={`Posts matching “${q}”`}
      errorMessage="Could not search posts."
      empty={{
        title: `No posts match “${q}”`,
        description: 'Try fewer or different words.',
      }}
    />
  );
}

function PeopleResults({ q }: { q: string }) {
  return (
    <UserList
      query={useUsers(q)}
      label={`People matching “${q}”`}
      errorMessage="Could not load people."
      empty={{
        title: `No one matches “${q}”`,
        description: 'Try another spelling or a shorter query.',
      }}
    />
  );
}

function Hint({ text }: { text: string }) {
  return <EmptyState icon={SearchIcon} title="Start typing" description={text} />;
}
