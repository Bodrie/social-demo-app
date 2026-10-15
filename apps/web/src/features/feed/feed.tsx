import { EmptyState, ErrorState } from '@/components/empty-state';
import { PostCard } from '@/features/posts/post-card';
import { PostListSkeleton, PostSkeleton } from '@/features/posts/post-skeleton';
import { useFeed } from '@/features/posts/use-posts';
import { flattenPages } from '@/lib/infinite';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';

export function Feed() {
  const feed = useFeed();
  const sentinelRef = useInfiniteScroll({
    enabled: feed.hasNextPage && !feed.isFetchingNextPage,
    onReachEnd: () => void feed.fetchNextPage(),
  });

  if (feed.isPending) return <PostListSkeleton />;
  if (feed.isError) {
    return <ErrorState message="Could not load your feed." onRetry={() => void feed.refetch()} />;
  }

  const posts = flattenPages(feed.data);
  if (posts.length === 0) {
    return (
      <EmptyState
        title="Your feed is empty"
        description="Follow people to see their posts here, or write the first one yourself."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div role="feed" aria-label="Posts" aria-busy={feed.isFetchingNextPage} className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {feed.isFetchingNextPage ? <PostSkeleton /> : null}
      {feed.hasNextPage ? null : (
        <p className="text-muted-foreground py-4 text-center text-sm">You&apos;re all caught up.</p>
      )}
    </div>
  );
}
