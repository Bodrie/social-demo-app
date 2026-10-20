import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import type { UserPublic } from '@beso/shared';
import { cn } from 'cn';
import { Loader2Icon } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { type Pages, flattenPages } from '@/lib/infinite';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';
import { UserListItem } from './user-list-item';

type UserListProps = {
  query: UseInfiniteQueryResult<Pages<UserPublic>>;
  empty: { title: string; description?: string };
  errorMessage: string;
  label: string;
};

/** Any cursor-paginated list of people, in one card with dividers. */
export function UserList({ query, empty, errorMessage, label }: UserListProps) {
  const sentinelRef = useInfiniteScroll({
    enabled: query.hasNextPage && !query.isFetchingNextPage,
    onReachEnd: () => void query.fetchNextPage(),
  });

  if (query.isPending) return <UserListSkeleton />;
  if (query.isError)
    return <ErrorState message={errorMessage} onRetry={() => void query.refetch()} />;

  const users = flattenPages(query.data);
  if (users.length === 0) return <EmptyState title={empty.title} description={empty.description} />;

  return (
    <div>
      <ul
        aria-label={label}
        aria-busy={query.isFetching}
        className={cn(
          'bg-card divide-y rounded-xl border transition-opacity',
          query.isPlaceholderData && 'opacity-60',
        )}
      >
        {users.map((user) => (
          <UserListItem key={user.id} user={user} />
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {query.isFetchingNextPage ? (
        <div className="text-muted-foreground flex justify-center py-4">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading more</span>
        </div>
      ) : null}
    </div>
  );
}

export function UserListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="bg-card divide-y rounded-xl border" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
