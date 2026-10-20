import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Post } from '@beso/shared';
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

/** The post as some cached list shows it, if any does. */
export function findCachedPost(queryClient: QueryClient, postId: string): Post | undefined {
  for (const [, data] of queryClient.getQueriesData<PostPages>(everyList)) {
    const post = data?.pages.flatMap((page) => page.items).find((item) => item.id === postId);
    if (post) return post;
  }
  return undefined;
}

/** The post lists that show the post, or have nothing yet (their first page may bring it). */
export function postListKeysShowing(queryClient: QueryClient, postId: string): QueryKey[] {
  return queryClient
    .getQueriesData<PostPages>(everyList)
    .filter(
      ([, data]) => !data || data.pages.some((page) => page.items.some((p) => p.id === postId)),
    )
    .map(([queryKey]) => queryKey);
}
