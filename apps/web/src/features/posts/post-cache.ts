import type { QueryClient } from '@tanstack/react-query';
import type { Post } from '@the-mesh/shared';
import { type Pages, filterItems, mapItems, prependItem } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

type PostPages = Pages<Post>;
const everyList = { queryKey: queryKeys.posts.lists };

/** A post can sit in several lists (feed, profiles); keep them all in step. */
export function updatePostEverywhere(
  queryClient: QueryClient,
  postId: string,
  update: (post: Post) => Post,
): void {
  queryClient.setQueriesData<PostPages>(
    everyList,
    (data) => data && mapItems(data, (post) => (post.id === postId ? update(post) : post)),
  );
}

export function removePostEverywhere(queryClient: QueryClient, postId: string): void {
  queryClient.setQueriesData<PostPages>(
    everyList,
    (data) => data && filterItems(data, (post) => post.id !== postId),
  );
}

/** Only lists that are already cached get the new post; others load it from the server. */
export function prependPostTo(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  post: Post,
): void {
  queryClient.setQueryData<PostPages>(queryKey, (data) => data && prependItem(data, post));
}

export type PostListsSnapshot = ReturnType<typeof snapshotPostLists>;

export function snapshotPostLists(queryClient: QueryClient) {
  return queryClient.getQueriesData<PostPages>(everyList);
}

export function restorePostLists(queryClient: QueryClient, snapshot: PostListsSnapshot): void {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data);
}
