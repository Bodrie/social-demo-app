import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import type { PostList } from '@the-mesh/shared';
import {
  fetchBookmarks,
  fetchFeed,
  fetchPost,
  fetchSearchPosts,
  fetchUserPosts,
} from '@/lib/api/posts';
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

export const searchPostsQueryOptions = (q: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.posts.search(q),
    queryFn: ({ pageParam, signal }) => fetchSearchPosts(q, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

/**
 * One post, cached as a single-page list under the posts lists prefix: likes, edits and a
 * delete made anywhere (the page itself included) reach it through `post-cache.ts`, and a
 * deleted post simply becomes an empty page (the query client never retries a 4xx).
 */
export const postQueryOptions = (postId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: async ({ signal }): Promise<PostList> => ({
      items: [await fetchPost(postId, signal)],
      nextCursor: null,
    }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: () => undefined,
  });

export const bookmarksQueryOptions = infiniteQueryOptions({
  queryKey: queryKeys.posts.bookmarks,
  queryFn: ({ pageParam, signal }) => fetchBookmarks({ cursor: pageParam, signal }),
  initialPageParam: NO_CURSOR,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

export function useFeed() {
  return useInfiniteQuery(feedQueryOptions);
}

export function useBookmarks() {
  return useInfiniteQuery(bookmarksQueryOptions);
}

export function useSearchPosts(q: string) {
  return useInfiniteQuery(searchPostsQueryOptions(q));
}

export function usePost(postId: string) {
  return useInfiniteQuery(postQueryOptions(postId));
}

export function useUserPosts(userId: string) {
  return useInfiniteQuery(userPostsQueryOptions(userId));
}
