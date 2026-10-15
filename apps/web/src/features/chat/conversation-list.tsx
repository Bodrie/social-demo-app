import type { Conversation } from '@the-mesh/shared';
import { cn } from 'cn';
import { MessageSquarePlusIcon } from 'lucide-react';
import { NavLink, useParams } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { formatRelativeTime } from '@/lib/format';
import { useChat } from './chat-context';
import { NewMessageDialog } from './new-message-dialog';
import { PresenceDot } from './presence-dot';
import { useConversations } from './use-messages';

export function ConversationList() {
  const conversations = useConversations();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-bold">Messages</h1>
        <NewMessageDialog>
          <Button size="icon-sm" variant="ghost" aria-label="New message">
            <MessageSquarePlusIcon />
          </Button>
        </NewMessageDialog>
      </div>
      {conversations.isPending ? (
        <ConversationListSkeleton />
      ) : conversations.isError ? (
        <p className="text-destructive px-4 py-6 text-sm">
          Could not load your conversations.{' '}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void conversations.refetch()}
          >
            Try again
          </Button>
        </p>
      ) : conversations.data.items.length === 0 ? (
        <div className="text-muted-foreground px-4 py-10 text-center text-sm">
          <p>No conversations yet.</p>
          <p className="mt-1">Pick someone from the people page or the online list and say hi.</p>
        </div>
      ) : (
        <ul
          aria-label="Conversations"
          tabIndex={0}
          className="min-h-0 flex-1 divide-y overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          {conversations.data.items.map((conversation) => (
            <ConversationItem key={conversation.peer.id} conversation={conversation} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const me = useCurrentUser();
  const { isOnline } = useChat();
  const { username } = useParams();
  const { peer, lastMessage, unreadCount } = conversation;
  const mine = lastMessage.senderId === me.id;
  const active = username === peer.username;

  return (
    <li>
      <NavLink
        to={`/messages/${peer.username}`}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-4 py-3 transition-colors',
          active ? 'bg-accent/60' : 'hover:bg-muted',
        )}
      >
        <span className="relative shrink-0">
          <UserAvatar user={peer} size="lg" />
          <PresenceDot online={isOnline(peer.id)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn('truncate text-sm', unreadCount > 0 ? 'font-bold' : 'font-semibold')}
            >
              {peer.name}
            </span>
            <time
              dateTime={lastMessage.createdAt}
              className="text-muted-foreground shrink-0 text-xs"
            >
              {formatRelativeTime(lastMessage.createdAt)}
            </time>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'truncate text-sm',
                unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {mine ? 'You: ' : ''}
              {lastMessage.content}
            </span>
            {unreadCount > 0 ? (
              <Badge className="h-5 min-w-5 shrink-0 rounded-full px-1.5 tabular-nums">
                <span className="sr-only">Unread: </span>
                {unreadCount}
              </Badge>
            ) : null}
          </span>
        </span>
      </NavLink>
    </li>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="divide-y" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
