import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import type { Post } from '@beso/shared';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { type Pages, flattenPages } from '@/lib/infinite';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';
import { PostCard } from './post-card';
import { PostListSkeleton, PostSkeleton } from './post-skeleton';

type PostListProps = {
  query: UseInfiniteQueryResult<Pages<Post>>;
  empty: { title: string; description?: string };
  errorMessage: string;
  label: string;
};

/** Any cursor-paginated list of posts: skeletons, errors, empty state and infinite scroll included. */
export function PostList({ query, empty, errorMessage, label }: PostListProps) {
  const sentinelRef = useInfiniteScroll({
    enabled: query.hasNextPage && !query.isFetchingNextPage,
    onReachEnd: () => void query.fetchNextPage(),
  });

  if (query.isPending) return <PostListSkeleton />;
  if (query.isError)
    return <ErrorState message={errorMessage} onRetry={() => void query.refetch()} />;

  const posts = flattenPages(query.data);
  if (posts.length === 0) return <EmptyState title={empty.title} description={empty.description} />;

  return (
    <div className="space-y-4">
      <div
        role="feed"
        aria-label={label}
        aria-busy={query.isFetchingNextPage}
        className="space-y-4"
      >
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {query.isFetchingNextPage ? <PostSkeleton /> : null}
      {query.hasNextPage ? null : (
        <p className="text-muted-foreground py-4 text-center text-sm">You&apos;re all caught up.</p>
      )}
    </div>
  );
}
