import type { Conversation } from '@the-mesh/shared';
import { cn } from 'cn';
import { UsersIcon } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { AVATAR_SIZE, type AvatarSize } from '@/lib/avatar-size';
import { directPeer } from './conversation-display';

type ConversationAvatarProps = {
  conversation: Conversation;
  meId: string;
  size?: AvatarSize;
  className?: string;
};

/** The other person's picture for a direct thread; a group tile otherwise. */
export function ConversationAvatar({
  conversation,
  meId,
  size = 'md',
  className,
}: ConversationAvatarProps) {
  const peer = directPeer(conversation, meId);
  if (peer) return <UserAvatar user={peer} size={size} className={className} />;
  return (
    <span
      className={cn(
        'bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full',
        AVATAR_SIZE[size],
        className,
      )}
      aria-hidden="true"
    >
      <UsersIcon className="size-1/2" />
    </span>
  );
}
