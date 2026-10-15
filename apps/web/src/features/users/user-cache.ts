import type { QueryClient } from '@tanstack/react-query';
import type { UserList, UserPublic } from '@the-mesh/shared';
import { type Pages, mapItems } from '@/lib/infinite';
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
