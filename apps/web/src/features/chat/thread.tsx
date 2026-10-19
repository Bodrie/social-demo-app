import { useQueryClient } from '@tanstack/react-query';
import type { Conversation } from '@the-mesh/shared';
import { cn } from 'cn';
import dayjs from 'dayjs';
import { ArrowLeftIcon, Loader2Icon, UsersIcon } from 'lucide-react';
import {
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ErrorState } from '@/components/empty-state';
import { RichText } from '@/components/rich-text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { isApiClientError } from '@/lib/api/client';
import { formatDateTime, formatDayLabel, formatTime } from '@/lib/format';
import { flattenPages } from '@/lib/infinite';
import { firstName } from '@/lib/names';
import { useChat } from './chat-context';
import { ConversationAvatar } from './conversation-avatar';
import {
  conversationName,
  directPeer,
  memberById,
  seenText,
  typingText,
} from './conversation-display';
import { GroupMembersDialog } from './group-members-dialog';
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
import { useMessages } from './use-conversations';

const GROUP_GAP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 80;
const LOAD_OLDER_PX = 200;

export function Thread({ conversation }: { conversation: Conversation }) {
  const me = useCurrentUser();
  const chat = useChat();
  const queryClient = useQueryClient();
  const thread = useMessages(conversation.id);
  const messages = useMemo(() => flattenPages(thread.data).toReversed(), [thread.data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const { setActiveConversation, markRead, setTyping } = chat;

  const peer = directPeer(conversation, me.id);
  const name = conversationName(conversation, me.id);
  const online = peer ? chat.isOnline(peer.id) : false;
  const typingNames = chat
    .typingIn(conversation.id)
    .map((userId) => memberById(conversation, userId)?.user.name ?? 'Someone');
  const typing = typingText(typingNames);

  useEffect(() => {
    setActiveConversation(conversation.id);
    return () => setActiveConversation(null);
  }, [setActiveConversation, conversation.id]);

  // Whatever is still unread gets marked once the thread is on screen.
  const hasUnread = conversation.unreadCount > 0;
  useEffect(() => {
    if (!hasUnread) return undefined;
    const readIfVisible = () => {
      if (document.visibilityState === 'visible') void markRead(conversation.id);
    };
    readIfVisible();
    document.addEventListener('visibilitychange', readIfVisible);
    return () => document.removeEventListener('visibilitychange', readIfVisible);
  }, [hasUnread, markRead, conversation.id]);

  // One announcement per message from somebody else, and none for the history that was
  // already there (or is loaded on scroll-up).
  const [announcement, setAnnouncement] = useState('');
  const newestSeenAt = useRef<string | null>(null);
  useEffect(() => {
    if (thread.isPending) return;
    const latest = messages.at(-1)?.createdAt ?? null;
    if (newestSeenAt.current === null) {
      newestSeenAt.current = latest ?? '';
      return;
    }
    const since = newestSeenAt.current;
    const fresh = messages.findLast(
      (message) => message.senderId !== me.id && message.createdAt > since,
    );
    if (latest && latest > since) newestSeenAt.current = latest;
    if (fresh) {
      const sender = firstName(memberById(conversation, fresh.senderId)?.user.name ?? 'Someone');
      setAnnouncement(`${sender}: ${fresh.content || 'sent a picture'}`);
    }
  }, [messages, me.id, conversation, thread.isPending]);

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
    if (retryOf) removeFromThread(queryClient, conversation.id, retryOf);
    const temp: ThreadMessage = {
      id: `pending-${crypto.randomUUID()}`,
      conversationId: conversation.id,
      senderId: me.id,
      content: outgoing.content,
      imageUrl: outgoing.previewUrl ?? null,
      imageKey: outgoing.imageKey,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    stickToBottom.current = true;
    appendToThread(queryClient, conversation.id, temp);
    try {
      const message = await chat.sendMessage(conversation.id, {
        content: outgoing.content,
        imageKey: outgoing.imageKey,
      });
      replaceInThread(queryClient, conversation.id, temp.id, message);
      upsertConversation(queryClient, message, { countUnread: false });
      // The bubble shows the server's copy now. A failed one keeps the preview for "Retry".
      if (outgoing.previewUrl) URL.revokeObjectURL(outgoing.previewUrl);
    } catch (error) {
      markFailedInThread(queryClient, conversation.id, temp.id);
      toast.error(isApiClientError(error) ? error.message : 'Could not send the message');
    }
  };

  const subtitle = typing
    ? conversation.kind === 'direct'
      ? 'typing…'
      : typing
    : peer
      ? online
        ? 'Online'
        : `@${peer.username}`
      : `${conversation.members.length} members`;

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
        {peer ? (
          <Link
            to={`/u/${peer.username}`}
            className="relative shrink-0"
            aria-hidden="true"
            tabIndex={-1}
          >
            <ConversationAvatar conversation={conversation} meId={me.id} />
            <PresenceDot online={online} />
          </Link>
        ) : (
          <ConversationAvatar conversation={conversation} meId={me.id} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            {peer ? (
              <Link to={`/u/${peer.username}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </h2>
          <p className={cn('truncate text-xs', typing ? 'text-primary' : 'text-muted-foreground')}>
            {subtitle}
          </p>
        </div>
        {conversation.kind === 'group' ? (
          <GroupMembersDialog conversation={conversation}>
            <Button variant="ghost" size="icon-sm" aria-label="Group members">
              <UsersIcon />
            </Button>
          </GroupMembersDialog>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        tabIndex={0}
        role="log"
        aria-label={peer ? `Conversation with ${name}` : `Group ${name}`}
        // Off: with the default "polite" every page of history, every optimistic bubble and
        // every "Sending…"/"Seen" swap would be read out. New messages from others are
        // announced once, through the status line below the log.
        aria-live="off"
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
                {peer
                  ? `This is the beginning of your conversation with ${name}.`
                  : `This is the beginning of ${name}. Say hi to everyone.`}
              </p>
            ) : (
              <MessageList
                messages={messages}
                meId={me.id}
                conversation={conversation}
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
            {typing ? <TypingIndicator text={typing} className="mt-1" /> : null}
          </>
        )}
      </div>

      <output aria-live="polite" className="sr-only block">
        {announcement}
      </output>

      <MessageComposer
        recipientName={name}
        onSend={(outgoing) => void send(outgoing)}
        onTyping={(isTyping) => setTyping(conversation.id, isTyping)}
      />
    </div>
  );
}

type MessageListProps = {
  messages: ThreadMessage[];
  meId: string;
  conversation: Conversation;
  onRetry: (message: ThreadMessage) => void;
};

function MessageList({ messages, meId, conversation, onRetry }: MessageListProps) {
  const lastMine = messages.findLast((m) => m.senderId === meId && !m.status);
  const seen = lastMine ? seenText(conversation, meId, lastMine.createdAt) : null;
  const showSeenOn = seen ? lastMine?.id : undefined;
  const isGroup = conversation.kind === 'group';
  const senderName = (userId: string) =>
    memberById(conversation, userId)?.user.name ?? 'A former member';

  return (
    <ol className="flex flex-col gap-0.5">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const mine = message.senderId === meId;
        const newDay = !previous || !dayjs(previous.createdAt).isSame(message.createdAt, 'day');
        const startOfRun = newDay || previous?.senderId !== message.senderId;
        const endOfGroup =
          !next ||
          next.senderId !== message.senderId ||
          dayjs(next.createdAt).diff(message.createdAt) > GROUP_GAP_MS;
        return (
          <li key={message.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
            <span className="sr-only">{mine ? 'You' : senderName(message.senderId)}: </span>
            {newDay ? (
              <div className="text-muted-foreground my-3 w-full text-center text-xs font-medium">
                {formatDayLabel(message.createdAt)}
              </div>
            ) : null}
            {isGroup && !mine && startOfRun ? (
              <p className="text-muted-foreground mb-0.5 ml-1 text-xs">
                {firstName(senderName(message.senderId))}
              </p>
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
                  <span className="sr-only">(opens in a new tab)</span>
                  <img
                    src={message.imageUrl}
                    alt={`Sent by ${mine ? 'you' : senderName(message.senderId)}`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-72 w-auto max-w-full object-cover"
                  />
                </a>
              ) : null}
              {message.content ? (
                <RichText
                  as="span"
                  text={message.content}
                  className={cn('block', message.imageUrl && 'px-2.5 pt-1.5 pb-1')}
                  linkClassName={mine ? 'text-primary-foreground underline' : undefined}
                />
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
                {message.id === showSeenOn ? ` · ${seen}` : ''}
              </p>
            ) : null}
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
