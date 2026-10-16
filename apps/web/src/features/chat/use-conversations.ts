import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { AddMembersInput, Conversation, ConversationList } from '@the-mesh/shared';
import {
  addMembers,
  createGroup,
  ensureDirectConversation,
  fetchConversation,
  fetchConversations,
  fetchMessages,
  leaveGroup,
} from '@/lib/api/conversations';
import { NO_CURSOR } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const conversationsQueryOptions = queryOptions({
  queryKey: queryKeys.conversations.list,
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

export const conversationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: ({ signal }) => fetchConversation(id, signal),
    staleTime: 60 * 1000,
  });

/** One conversation; starts from the list's copy when that is already loaded. */
export function useConversation(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    ...conversationQueryOptions(id),
    initialData: () =>
      queryClient
        .getQueryData<ConversationList>(queryKeys.conversations.list)
        ?.items.find((row) => row.id === id),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKeys.conversations.list)?.dataUpdatedAt,
  });
}

export const messagesQueryOptions = (conversationId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: ({ pageParam, signal }) =>
      fetchMessages(conversationId, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: Infinity,
  });

export function useMessages(conversationId: string) {
  return useInfiniteQuery(messagesQueryOptions(conversationId));
}

/** Replaces the conversation in the list, or puts it on top when it was not there. */
export function putInList(
  queryClient: ReturnType<typeof useQueryClient>,
  conversation: Conversation,
): void {
  queryClient.setQueryData<ConversationList>(queryKeys.conversations.list, (list) => {
    if (!list) return list;
    const exists = list.items.some((row) => row.id === conversation.id);
    return {
      ...list,
      items: exists
        ? list.items.map((row) => (row.id === conversation.id ? conversation : row))
        : [conversation, ...list.items],
    };
  });
}

export function useEnsureDirect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ensureDirectConversation,
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.conversations.detail(conversation.id), conversation);
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGroup,
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.conversations.detail(conversation.id), conversation);
      putInList(queryClient, conversation);
    },
  });
}

export function useAddMembers(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMembersInput) => addMembers(conversationId, input),
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.conversations.detail(conversation.id), conversation);
      putInList(queryClient, conversation);
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: leaveGroup,
    onSuccess: (_, conversationId) => forgetConversation(queryClient, conversationId),
  });
}

/** Drops every trace of a conversation the viewer is no longer part of. */
export function forgetConversation(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
): void {
  queryClient.setQueryData<ConversationList>(
    queryKeys.conversations.list,
    (list) => list && { ...list, items: list.items.filter((row) => row.id !== conversationId) },
  );
  queryClient.removeQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
  queryClient.removeQueries({ queryKey: queryKeys.conversations.messages(conversationId) });
}
