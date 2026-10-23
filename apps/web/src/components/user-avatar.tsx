import type { UserSummary } from '@beso/shared';
import { cn } from 'cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AVATAR_SIZE, type AvatarSize } from '@/lib/avatar-size';
import { initials } from '@/lib/names';

const FALLBACK_TEXT = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm', xl: 'text-2xl' } as const;

/** The Collector ring (ADR 0021, "Rewards") in its metal tones; a gap keeps it off the face. */
const RING = {
  bronze: 'outline-collector-bronze',
  silver: 'outline-collector-silver',
  gold: 'outline-collector-gold',
  platinum: 'outline-collector-platinum',
} as const;
const RING_WIDTH = {
  sm: 'outline-2 outline-offset-1',
  md: 'outline-2 outline-offset-1',
  lg: 'outline-2 outline-offset-2',
  xl: 'outline-4 outline-offset-3',
} as const;

type UserAvatarProps = {
  user: Pick<UserSummary, 'name' | 'avatarUrl'> & { ring?: UserSummary['ring'] };
  size?: AvatarSize;
  className?: string;
};

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const ring = user.ring ? cn(RING_WIDTH[size], RING[user.ring]) : null;
  return (
    <Avatar data-ring={user.ring ?? undefined} className={cn(AVATAR_SIZE[size], ring, className)}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
      <AvatarFallback
        className={cn('bg-accent text-accent-foreground font-semibold', FALLBACK_TEXT[size])}
      >
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
