import { useQueryClient } from '@tanstack/react-query';
import type { UserSummary } from '@the-mesh/shared';
import { cn } from 'cn';
import dayjs from 'dayjs';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import { type UIEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ErrorState } from '@/components/empty-state';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { isApiClientError } from '@/lib/api/client';
import { formatDateTime, formatDayLabel, formatTime } from '@/lib/format';
import { flattenPages } from '@/lib/infinite';
import { useChat } from './chat-context';
import {
  type ThreadMessage,
  appendToThread,
  markFailedInThread,
  removeFromThread,
  replaceInThread,
  upsertConversation,
} from './message-cache';
import { MessageComposer, type OutgoingMessage } from './message-composer';
import { PresenceDot } from './presence-dot';
import { TypingIndicator } from './typing-indicator';
import { useThread } from './use-messages';

const GROUP_GAP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 80;
const LOAD_OLDER_PX = 200;

export function Thread({ peer }: { peer: UserSummary }) {
  const me = useCurrentUser();
  const chat = useChat();
  const queryClient = useQueryClient();
  const thread = useThread(peer.id);
  const messages = useMemo(() => flattenPages(thread.data).toReversed(), [thread.data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const online = chat.isOnline(peer.id);
  const typing = chat.isTyping(peer.id);
  const { setActivePeer, markRead, setTyping } = chat;

  useEffect(() => {
    setActivePeer(peer.id);
    return () => setActivePeer(null);
  }, [setActivePeer, peer.id]);

  // Whatever the peer sent that is still unread gets marked once it is on screen.
  const unreadFromPeer = messages.some(
    (message) => message.senderId === peer.id && !message.readAt,
  );
  useEffect(() => {
    if (!unreadFromPeer) return undefined;
    const readIfVisible = () => {
      if (document.visibilityState === 'visible') void markRead(peer.id);
    };
    readIfVisible();
    document.addEventListener('visibilitychange', readIfVisible);
    return () => document.removeEventListener('visibilitychange', readIfVisible);
  }, [unreadFromPeer, markRead, peer.id]);

  // Stay pinned to the newest message (or the typing dots) unless the viewer scrolled up.
  const messageCount = messages.length;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if ((messageCount > 0 || typing) && element && stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messageCount, typing]);

  const loadOlder = useCallback(async () => {
    const element = scrollRef.current;
    const before = element?.scrollHeight ?? 0;
    await thread.fetchNextPage();
    requestAnimationFrame(() => {
      if (element) element.scrollTop += element.scrollHeight - before;
    });
  }, [thread]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    stickToBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    if (element.scrollTop < LOAD_OLDER_PX && thread.hasNextPage && !thread.isFetchingNextPage) {
      void loadOlder();
    }
  };

  const send = async (outgoing: OutgoingMessage, retryOf?: string) => {
    if (retryOf) removeFromThread(queryClient, peer.id, retryOf);
    const temp: ThreadMessage = {
      id: `pending-${crypto.randomUUID()}`,
      senderId: me.id,
      recipientId: peer.id,
      content: outgoing.content,
      imageUrl: outgoing.previewUrl ?? null,
      imageKey: outgoing.imageKey,
      createdAt: new Date().toISOString(),
      readAt: null,
      status: 'sending',
    };
    stickToBottom.current = true;
    appendToThread(queryClient, peer.id, temp);
    try {
      const message = await chat.sendMessage(peer.id, {
        content: outgoing.content,
        imageKey: outgoing.imageKey,
      });
      replaceInThread(queryClient, peer.id, temp.id, message);
      upsertConversation(queryClient, me.id, message, { countUnread: false });
    } catch (error) {
      markFailedInThread(queryClient, peer.id, temp.id);
      toast.error(isApiClientError(error) ? error.message : 'Could not send the message');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-2.5">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="Back to conversations"
        >
          <Link to="/messages">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <Link
          to={`/u/${peer.username}`}
          className="relative shrink-0"
          aria-hidden="true"
          tabIndex={-1}
        >
          <UserAvatar user={peer} />
          <PresenceDot online={online} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${peer.username}`} className="block truncate font-semibold hover:underline">
            {peer.name}
          </Link>
          <p className={cn('text-xs', typing ? 'text-primary' : 'text-muted-foreground')}>
            {typing ? 'typing…' : online ? 'Online' : `@${peer.username}`}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        tabIndex={0}
        role="log"
        aria-label={`Conversation with ${peer.name}`}
        aria-live="polite"
      >
        {thread.isPending ? (
          <ThreadSkeleton />
        ) : thread.isError ? (
          <ErrorState
            message="Could not load this conversation."
            onRetry={() => void thread.refetch()}
          />
        ) : (
          <>
            {thread.isFetchingNextPage ? (
              <div className="text-muted-foreground flex justify-center py-2">
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading older messages</span>
              </div>
            ) : null}
            {messages.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                This is the beginning of your conversation with {peer.name}.
              </p>
            ) : (
              <MessageList
                messages={messages}
                meId={me.id}
                peer={peer}
                onRetry={(message) =>
                  void send(
                    {
                      content: message.content,
                      imageKey: message.imageKey,
                      previewUrl: message.imageUrl ?? undefined,
                    },
                    message.id,
                  )
                }
              />
            )}
            {typing ? <TypingIndicator name={peer.name} className="mt-1" /> : null}
          </>
        )}
      </div>

      <MessageComposer
        peerName={peer.name}
        onSend={(outgoing) => void send(outgoing)}
        onTyping={(isTyping) => setTyping(peer.id, isTyping)}
      />
    </div>
  );
}

type MessageListProps = {
  messages: ThreadMessage[];
  meId: string;
  peer: UserSummary;
  onRetry: (message: ThreadMessage) => void;
};

function MessageList({ messages, meId, peer, onRetry }: MessageListProps) {
  const newestFirst = messages.toReversed();
  const lastSeenMine = newestFirst.find((m) => m.senderId === meId && m.readAt !== null);
  const lastMine = newestFirst.find((m) => m.senderId === meId);
  const showSeenOn = lastSeenMine && lastSeenMine.id === lastMine?.id ? lastSeenMine.id : null;

  return (
    <ol className="flex flex-col gap-0.5">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const mine = message.senderId === meId;
        const newDay = !previous || !dayjs(previous.createdAt).isSame(message.createdAt, 'day');
        const endOfGroup =
          !next ||
          next.senderId !== message.senderId ||
          dayjs(next.createdAt).diff(message.createdAt) > GROUP_GAP_MS;
        return (
          <li key={message.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
            {newDay ? (
              <div className="text-muted-foreground my-3 w-full text-center text-xs font-medium">
                {formatDayLabel(message.createdAt)}
              </div>
            ) : null}
            <div
              title={formatDateTime(message.createdAt)}
              className={cn(
                'max-w-[78%] rounded-2xl text-[15px]/5 break-words whitespace-pre-wrap',
                message.imageUrl ? 'p-1' : 'px-3.5 py-2',
                mine
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted rounded-bl-md',
                message.status === 'sending' && 'opacity-70',
                message.status === 'failed' && 'bg-destructive/15 text-foreground',
              )}
            >
              {message.imageUrl ? (
                <a
                  href={message.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <img
                    src={message.imageUrl}
                    alt={`Sent by ${mine ? 'you' : peer.name}`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-72 w-auto max-w-full object-cover"
                  />
                </a>
              ) : null}
              {message.content ? (
                <span className={cn('block', message.imageUrl && 'px-2.5 pt-1.5 pb-1')}>
                  {message.content}
                </span>
              ) : null}
            </div>
            {message.status === 'failed' ? (
              <p className="text-destructive mt-0.5 text-xs">
                Not sent.{' '}
                <button type="button" className="underline" onClick={() => onRetry(message)}>
                  Retry
                </button>
              </p>
            ) : endOfGroup || message.id === showSeenOn ? (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {message.status === 'sending' ? 'Sending…' : formatTime(message.createdAt)}
                {message.id === showSeenOn ? ' · Seen' : ''}
              </p>
            ) : null}
            <span className="sr-only">{mine ? 'You' : peer.name}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-9 w-2/5 rounded-2xl" />
      <Skeleton className="ml-auto h-9 w-1/2 rounded-2xl" />
      <Skeleton className="h-14 w-3/5 rounded-2xl" />
      <Skeleton className="ml-auto h-9 w-1/3 rounded-2xl" />
    </div>
  );
}
