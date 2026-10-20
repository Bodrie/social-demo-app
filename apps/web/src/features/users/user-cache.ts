import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { UserList, UserPublic } from '@beso/shared';
import { type Pages, flattenPages, mapItems } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

/** A user appears in profile queries and in many lists (followers, search, suggestions); keep them all in step. */
export function updateUserEverywhere(
  queryClient: QueryClient,
  userId: string,
  update: (user: UserPublic) => UserPublic,
): void {
  queryClient.setQueriesData<UserPublic>({ queryKey: queryKeys.users.profiles }, (user) =>
    user && user.id === userId ? update(user) : user,
  );
  queryClient.setQueriesData<Pages<UserPublic>>(
    { queryKey: queryKeys.users.lists },
    (data) => data && mapItems(data, (user) => (user.id === userId ? update(user) : user)),
  );
  queryClient.setQueriesData<UserList>(
    { queryKey: queryKeys.users.suggestions },
    (data) =>
      data && {
        ...data,
        items: data.items.map((user) => (user.id === userId ? update(user) : user)),
      },
  );
}

/** The profiles and user lists that show one of these users, or have nothing yet. */
export function userQueryKeysShowing(
  queryClient: QueryClient,
  userIds: readonly string[],
): QueryKey[] {
  const shows = (user: UserPublic) => userIds.includes(user.id);
  return [
    ...queryClient
      .getQueriesData<UserPublic>({ queryKey: queryKeys.users.profiles })
      .filter(([, user]) => !user || shows(user)),
    ...queryClient
      .getQueriesData<Pages<UserPublic>>({ queryKey: queryKeys.users.lists })
      .filter(([, data]) => !data || flattenPages(data).some(shows)),
    ...queryClient
      .getQueriesData<UserList>({ queryKey: queryKeys.users.suggestions })
      .filter(([, data]) => !data || data.items.some(shows)),
  ].map(([queryKey]) => queryKey);
}
