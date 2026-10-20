import { cn } from 'cn';
import { XIcon } from 'lucide-react';
import type { Ref } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/features/auth/current-user';
import { useChat } from '../chat-context';
import { ConversationAvatar } from '../conversation-avatar';
import { conversationName, directPeer } from '../conversation-display';
import { PresenceDot } from '../presence-dot';
import { useConversation } from '../use-conversations';

type ChatBubbleProps = {
  id: string;
  /** Its window is open. */
  active: boolean;
  /** Phones have no hover: the hide button is always drawn. */
  alwaysShowHide?: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  ref?: Ref<HTMLButtonElement>;
};

/** One conversation in the dock: avatar, presence, unread badge, and the X that hides it. */
export function ChatBubble({
  id,
  active,
  alwaysShowHide = false,
  onOpen,
  onDismiss,
  ref,
}: ChatBubbleProps) {
  const me = useCurrentUser();
  const chat = useChat();
  const conversation = useConversation(id);
  if (!conversation.data) {
    return (
      <li aria-hidden="true">
        <Skeleton className="size-12 rounded-full" />
      </li>
    );
  }
  const row = conversation.data;
  const name = conversationName(row, me.id);
  const peer = directPeer(row, me.id);
  const unread = row.unreadCount;

  return (
    <li className="group relative shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            aria-label={
              unread > 0 ? `Open chat with ${name}, ${unread} unread` : `Open chat with ${name}`
            }
            aria-expanded={active}
            className={cn(
              'bg-card relative flex size-12 items-center justify-center rounded-full border shadow-md transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50',
              active && 'ring-primary ring-2',
            )}
            onClick={onOpen}
          >
            <ConversationAvatar conversation={row} meId={me.id} size="lg" />
            {peer ? <PresenceDot online={chat.isOnline(peer.id)} /> : null}
            {unread > 0 ? (
              <span
                aria-hidden="true"
                className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side={alwaysShowHide ? 'bottom' : 'left'}>{name}</TooltipContent>
      </Tooltip>
      <button
        type="button"
        aria-label={`Hide chat with ${name}`}
        className={cn(
          'bg-background text-muted-foreground hover:text-foreground absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full border shadow-sm transition-opacity',
          !alwaysShowHide && 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
        )}
        onClick={onDismiss}
      >
        <XIcon className="size-3" aria-hidden="true" />
      </button>
    </li>
  );
}
