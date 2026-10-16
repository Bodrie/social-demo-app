import type { QueryClient } from '@tanstack/react-query';
import type { Conversation, ConversationList, Message } from '@the-mesh/shared';
import { isApiClientError } from '@/lib/api/client';
import { type Pages, filterItems, mapItems, prependItem } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';
import { conversationQueryOptions, forgetConversation, putInList } from './use-conversations';

/** A message as the thread shows it; `status` and `imageKey` only exist on optimistic copies. */
export type ThreadMessage = Message & { status?: 'sending' | 'failed'; imageKey?: string };
type ThreadPages = Pages<ThreadMessage>;

/**
 * Newest first in the cache (like the API); only touches threads that are already loaded.
 * The server pushes my own messages back before the ack resolves, so a push replaces the
 * optimistic copy it confirms instead of sitting next to it.
 */
export function appendToThread(
  queryClient: QueryClient,
  conversationId: string,
  message: ThreadMessage,
): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.conversations.messages(conversationId),
    (data) => {
      if (!data) return data;
      const confirmed = message.status
        ? data
        : withoutFirstPending(
            data,
            (item) =>
              item.senderId === message.senderId &&
              item.content === message.content &&
              (item.imageUrl === null) === (message.imageUrl === null),
          );
      return prependItem(confirmed, message);
    },
  );
}

function withoutFirstPending(
  data: ThreadPages,
  matches: (item: ThreadMessage) => boolean,
): ThreadPages {
  let dropped = false;
  return filterItems(data, (item) => {
    if (dropped || item.status !== 'sending' || !matches(item)) return true;
    dropped = true;
    return false;
  });
}

/** Swaps an optimistic copy for the persisted message (which may already have arrived by push). */
export function replaceInThread(
  queryClient: QueryClient,
  conversationId: string,
  tempId: string,
  message: Message,
): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.conversations.messages(conversationId),
    (data) => {
      if (!data) return data;
      const withoutTemp = filterItems(data, (item) => item.id !== tempId);
      return prependItem(withoutTemp, message);
    },
  );
}

export function markFailedInThread(
  queryClient: QueryClient,
  conversationId: string,
  tempId: string,
): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.conversations.messages(conversationId),
    (data) =>
      data && mapItems(data, (item) => (item.id === tempId ? { ...item, status: 'failed' } : item)),
  );
}

export function removeFromThread(
  queryClient: QueryClient,
  conversationId: string,
  id: string,
): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.conversations.messages(conversationId),
    (data) => data && filterItems(data, (item) => item.id !== id),
  );
}

/** Applies the same change to the list row and the detail query of one conversation. */
function patchConversation(
  queryClient: QueryClient,
  conversationId: string,
  patch: (conversation: Conversation) => Conversation,
): void {
  queryClient.setQueryData<ConversationList>(
    queryKeys.conversations.list,
    (list) =>
      list && {
        ...list,
        items: list.items.map((row) => (row.id === conversationId ? patch(row) : row)),
      },
  );
  queryClient.setQueryData<Conversation>(
    queryKeys.conversations.detail(conversationId),
    (conversation) => conversation && patch(conversation),
  );
}

const withReadMark = (
  conversation: Conversation,
  userId: string,
  readAt: string,
): Conversation => ({
  ...conversation,
  members: conversation.members.map((member) =>
    member.user.id === userId && (member.lastReadAt === null || member.lastReadAt < readAt)
      ? { ...member, lastReadAt: readAt }
      : member,
  ),
});

/** `userId` caught up (a push about someone else, or my own read, which also clears my badge). */
export function setMemberReadAt(
  queryClient: QueryClient,
  conversationId: string,
  userId: string,
  readAt: string,
  options: { clearUnread: boolean },
): void {
  patchConversation(queryClient, conversationId, (conversation) => ({
    ...withReadMark(conversation, userId, readAt),
    unreadCount: options.clearUnread ? 0 : conversation.unreadCount,
  }));
}

/**
 * A message arrived (push or ack): the conversation moves to the top with it as the last
 * message, and the sender's read mark follows it. A conversation the list has never seen
 * is inserted from its detail query when that is loaded, otherwise the list is refetched.
 */
export function upsertConversation(
  queryClient: QueryClient,
  message: Message,
  options: { countUnread: boolean },
): void {
  const list = queryClient.getQueryData<ConversationList>(queryKeys.conversations.list);
  if (!list) return;
  const existing = list.items.find((row) => row.id === message.conversationId);
  const bump = (conversation: Conversation): Conversation => ({
    ...withReadMark(conversation, message.senderId, message.createdAt),
    lastMessage: message,
    lastMessageAt: message.createdAt,
  });
  if (!existing) {
    const detail = queryClient.getQueryData<Conversation>(
      queryKeys.conversations.detail(message.conversationId),
    );
    if (detail) {
      putInList(queryClient, { ...bump(detail), unreadCount: options.countUnread ? 1 : 0 });
    } else {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list });
    }
    return;
  }
  if (existing.lastMessage?.id === message.id) return;
  const updated = {
    ...bump(existing),
    unreadCount: existing.unreadCount + (options.countUnread ? 1 : 0),
  };
  queryClient.setQueryData<ConversationList>(queryKeys.conversations.list, {
    ...list,
    items: [updated, ...list.items.filter((row) => row.id !== message.conversationId)],
  });
  queryClient.setQueryData<Conversation>(
    queryKeys.conversations.detail(message.conversationId),
    (conversation) =>
      conversation && {
        ...bump(conversation),
        unreadCount: conversation.unreadCount + (options.countUnread ? 1 : 0),
      },
  );
}

/** `conversation:update`: fetch the fresh copy; a 404 means I am no longer in it. */
export async function refreshConversation(
  queryClient: QueryClient,
  conversationId: string,
): Promise<void> {
  try {
    const conversation = await queryClient.fetchQuery({
      ...conversationQueryOptions(conversationId),
      staleTime: 0,
    });
    putInList(queryClient, conversation);
  } catch (error) {
    if (isApiClientError(error) && error.status === 404) {
      forgetConversation(queryClient, conversationId);
    }
  }
}
