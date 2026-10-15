import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { fetchFeed, fetchUserPosts } from '@/lib/api/posts';
import { NO_CURSOR } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const feedQueryOptions = infiniteQueryOptions({
  queryKey: queryKeys.posts.feed,
  queryFn: ({ pageParam, signal }) => fetchFeed({ cursor: pageParam, signal }),
  initialPageParam: NO_CURSOR,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

export const userPostsQueryOptions = (userId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.posts.byUser(userId),
    queryFn: ({ pageParam, signal }) => fetchUserPosts(userId, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export function useFeed() {
  return useInfiniteQuery(feedQueryOptions);
}

export function useUserPosts(userId: string) {
  return useInfiniteQuery(userPostsQueryOptions(userId));
}
