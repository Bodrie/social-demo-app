import {
  type QueryClient,
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { Notification, UnreadCount } from '@beso/shared';
import {
  fetchNotifications,
  fetchUnreadNotifications,
  markAllNotificationsRead,
} from '@/lib/api/notifications';
import { NO_CURSOR, type Pages, filterItems, flattenPages, prependItem } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const notificationsQueryOptions = infiniteQueryOptions({
  queryKey: queryKeys.notifications.list,
  queryFn: ({ pageParam, signal }) => fetchNotifications({ cursor: pageParam, signal }),
  initialPageParam: NO_CURSOR,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

export function useNotifications() {
  return useInfiniteQuery(notificationsQueryOptions);
}

export const unreadNotificationsQueryOptions = queryOptions({
  queryKey: queryKeys.notifications.unread,
  queryFn: ({ signal }) => fetchUnreadNotifications(signal),
  staleTime: 60 * 1000,
  // Off app-wide (app/query-client.ts); the bell needs it, since another tab may have read.
  refetchOnWindowFocus: true,
});

/** The bell's number. Pushes raise it; a tab regaining focus refetches (another tab may have read). */
export function useUnreadNotifications(): number {
  const { data } = useQuery(unreadNotificationsQueryOptions);
  return data?.count ?? 0;
}

/**
 * A push from the server: the item tops the loaded list (replacing an older copy of itself,
 * since a repeated event refreshes the row and keeps its id) and the bell goes up by one,
 * unless that older copy was still unread.
 */
export function receiveNotification(queryClient: QueryClient, notification: Notification): void {
  const pages = queryClient.getQueryData<Pages<Notification>>(queryKeys.notifications.list);
  const previous = pages && flattenPages(pages).find((item) => item.id === notification.id);
  if (pages) {
    queryClient.setQueryData<Pages<Notification>>(
      queryKeys.notifications.list,
      prependItem(
        filterItems(pages, (item) => item.id !== notification.id),
        notification,
      ),
    );
  }
  if (previous?.readAt === null) return;
  const unread = queryClient.getQueryData<UnreadCount>(queryKeys.notifications.unread);
  if (unread) {
    queryClient.setQueryData<UnreadCount>(queryKeys.notifications.unread, {
      count: unread.count + 1,
    });
  } else {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
  }
}

/**
 * Everything up to now is read; the bell drops at once. The loaded list keeps the rows as
 * they were fetched, so the ones that were new stay marked until the next visit.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => {
      queryClient.setQueryData<UnreadCount>(queryKeys.notifications.unread, { count: 0 });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
    },
  });
}
