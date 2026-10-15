import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { fetchConversations, fetchThread } from '@/lib/api/messages';
import { NO_CURSOR } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const conversationsQueryOptions = queryOptions({
  queryKey: queryKeys.messages.conversations,
  queryFn: ({ signal }) => fetchConversations(signal),
  // Kept current by socket pushes; the refetch is a safety net.
  staleTime: 60 * 1000,
});

export function useConversations() {
  return useQuery(conversationsQueryOptions);
}

/** Unread messages across all conversations, for the navigation badge. */
export function useUnreadCount(): number {
  const { data } = useQuery({
    ...conversationsQueryOptions,
    select: (list) => list.items.reduce((sum, row) => sum + row.unreadCount, 0),
  });
  return data ?? 0;
}

export const threadQueryOptions = (peerId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.messages.thread(peerId),
    queryFn: ({ pageParam, signal }) => fetchThread(peerId, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: Infinity,
  });

export function useThread(peerId: string) {
  return useInfiniteQuery(threadQueryOptions(peerId));
}
