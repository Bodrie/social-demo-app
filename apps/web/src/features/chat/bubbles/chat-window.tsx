import { cn } from 'cn';
import { ChevronDownIcon, ExpandIcon, MinusIcon } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { useChat } from '../chat-context';
import { ConversationAvatar } from '../conversation-avatar';
import { conversationName, directPeer, memberById, typingText } from '../conversation-display';
import { Thread } from '../thread';
import { useConversation } from '../use-conversations';

type ChatWindowProps = {
  id: string;
  /** Full width below the bubble row instead of a docked box. */
  phone?: boolean;
  className?: string;
  onMinimise: () => void;
};

/**
 * A docked mini thread: the same `Thread` as the messages page (same cache, same read marks),
 * with its own header. A non-modal dialog: focus goes in when it opens, Escape brings it back out.
 */
export function ChatWindow({ id, phone = false, className, onMinimise }: ChatWindowProps) {
  const me = useCurrentUser();
  const chat = useChat();
  const conversation = useConversation(id);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onMinimise();
    }
  };

  const row = conversation.data;
  const name = row ? conversationName(row, me.id) : 'Chat';
  const peer = row ? directPeer(row, me.id) : null;
  const typing = row
    ? typingText(chat.typingIn(id).map((userId) => memberById(row, userId)?.user.name ?? 'Someone'))
    : null;
  const subtitle = !row
    ? ''
    : typing
      ? row.kind === 'direct'
        ? 'typing…'
        : typing
      : peer
        ? chat.isOnline(peer.id)
          ? 'Online'
          : `@${peer.username}`
        : `${row.members.length} members`;

  return (
    <dialog
      open
      ref={ref}
      tabIndex={-1}
      aria-label={`Chat with ${name}`}
      onKeyDown={onKeyDown}
      className={cn(
        'bg-card text-card-foreground static m-0 flex max-h-none max-w-none flex-col border p-0 shadow-xl outline-none',
        phone
          ? 'min-h-0 w-full flex-1 border-x-0 border-b-0'
          : 'h-[27.5rem] w-80 rounded-t-xl border-b-0',
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        {row ? (
          <ConversationAvatar conversation={row} meId={me.id} size="sm" />
        ) : (
          <Skeleton className="size-6 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{name}</h2>
          <p className={cn('truncate text-xs', typing ? 'text-primary' : 'text-muted-foreground')}>
            {subtitle}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={`/messages/${id}`} aria-label={`Open the chat with ${name} in Messages`}>
            <ExpandIcon />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Minimise chat with ${name}`}
          onClick={onMinimise}
        >
          {phone ? <ChevronDownIcon /> : <MinusIcon />}
        </Button>
      </header>
      {row ? (
        <Thread conversation={row} embedded className="min-h-0 flex-1" />
      ) : (
        <div className="flex-1 p-4" aria-busy="true">
          <Skeleton className="h-full w-full" />
        </div>
      )}
    </dialog>
  );
}
