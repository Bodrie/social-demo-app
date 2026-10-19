import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { fetchTagPosts, fetchTrendingTags } from '@/lib/api/tags';
import { NO_CURSOR } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

/** Under `queryKeys.posts.lists`, so likes, edits and deletes reach the tag page too. */
export const tagPostsQueryOptions = (tag: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.posts.byTag(tag),
    queryFn: ({ pageParam, signal }) => fetchTagPosts(tag, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export function useTagPosts(tag: string) {
  return useInfiniteQuery(tagPostsQueryOptions(tag));
}

export const trendingTagsQueryOptions = (limit: number) =>
  queryOptions({
    queryKey: [...queryKeys.tags.trending, limit] as const,
    queryFn: ({ signal }) => fetchTrendingTags(limit, signal),
    select: (data) => data.items,
    staleTime: 60_000,
  });

export function useTrendingTags(limit = 5) {
  return useQuery(trendingTagsQueryOptions(limit));
}
