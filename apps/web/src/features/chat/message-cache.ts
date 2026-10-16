import type { QueryClient } from '@tanstack/react-query';
import type { Conversation, ConversationList, Message } from '@the-mesh/shared';
import { type Pages, filterItems, mapItems, prependItem } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

/** A message as the thread shows it; `status` and `imageKey` only exist on optimistic copies. */
export type ThreadMessage = Message & { status?: 'sending' | 'failed'; imageKey?: string };
type ThreadPages = Pages<ThreadMessage>;

export const peerOf = (message: Message, meId: string): string =>
  message.senderId === meId ? message.recipientId : message.senderId;

/**
 * Newest first in the cache (like the API); only touches threads that are already loaded.
 * The server pushes my own messages back before the ack resolves, so a push replaces the
 * optimistic copy it confirms instead of sitting next to it.
 */
export function appendToThread(
  queryClient: QueryClient,
  peerId: string,
  message: ThreadMessage,
): void {
  queryClient.setQueryData<ThreadPages>(queryKeys.messages.thread(peerId), (data) => {
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
  });
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
  peerId: string,
  tempId: string,
  message: Message,
): void {
  queryClient.setQueryData<ThreadPages>(queryKeys.messages.thread(peerId), (data) => {
    if (!data) return data;
    const withoutTemp = filterItems(data, (item) => item.id !== tempId);
    return prependItem(withoutTemp, message);
  });
}

export function markFailedInThread(queryClient: QueryClient, peerId: string, tempId: string): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.messages.thread(peerId),
    (data) =>
      data && mapItems(data, (item) => (item.id === tempId ? { ...item, status: 'failed' } : item)),
  );
}

export function removeFromThread(queryClient: QueryClient, peerId: string, id: string): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.messages.thread(peerId),
    (data) => data && filterItems(data, (item) => item.id !== id),
  );
}

/** The peer read what I sent them (`conversation:read`). */
export function markSentRead(
  queryClient: QueryClient,
  peerId: string,
  meId: string,
  readAt: string,
): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.messages.thread(peerId),
    (data) =>
      data &&
      mapItems(data, (item) =>
        item.senderId === meId && item.readAt === null ? { ...item, readAt } : item,
      ),
  );
  queryClient.setQueryData<ConversationList>(
    queryKeys.messages.conversations,
    (data) =>
      data && {
        ...data,
        items: data.items.map((row) =>
          row.peer.id === peerId &&
          row.lastMessage.senderId === meId &&
          row.lastMessage.readAt === null
            ? { ...row, lastMessage: { ...row.lastMessage, readAt } }
            : row,
        ),
      },
  );
}

/** I read the peer's messages: clear the unread badge and the local copies. */
export function markReceivedRead(queryClient: QueryClient, peerId: string, readAt: string): void {
  queryClient.setQueryData<ThreadPages>(
    queryKeys.messages.thread(peerId),
    (data) =>
      data &&
      mapItems(data, (item) =>
        item.senderId === peerId && item.readAt === null ? { ...item, readAt } : item,
      ),
  );
  queryClient.setQueryData<ConversationList>(
    queryKeys.messages.conversations,
    (data) =>
      data && {
        ...data,
        items: data.items.map((row) => (row.peer.id === peerId ? { ...row, unreadCount: 0 } : row)),
      },
  );
}

/**
 * A message arrived (push or ack): move the conversation to the top with it as the last
 * message. Unknown peers need their summary, so the list is refetched instead.
 */
export function upsertConversation(
  queryClient: QueryClient,
  meId: string,
  message: Message,
  options: { countUnread: boolean },
): void {
  const peerId = peerOf(message, meId);
  const current = queryClient.getQueryData<ConversationList>(queryKeys.messages.conversations);
  if (!current) return;
  const existing = current.items.find((row) => row.peer.id === peerId);
  if (!existing) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.messages.conversations });
    return;
  }
  if (existing.lastMessage.id === message.id) return;
  const updated: Conversation = {
    ...existing,
    lastMessage: message,
    unreadCount: existing.unreadCount + (options.countUnread ? 1 : 0),
  };
  queryClient.setQueryData<ConversationList>(queryKeys.messages.conversations, {
    ...current,
    items: [updated, ...current.items.filter((row) => row.peer.id !== peerId)],
  });
}
