import type { UserSummary } from '@the-mesh/shared';
import { cn } from 'cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AVATAR_SIZE, type AvatarSize } from '@/lib/avatar-size';
import { initials } from '@/lib/names';

const FALLBACK_TEXT = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm', xl: 'text-2xl' } as const;

type UserAvatarProps = {
  user: Pick<UserSummary, 'name' | 'avatarUrl'>;
  size?: AvatarSize;
  className?: string;
};

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  return (
    <Avatar className={cn(AVATAR_SIZE[size], className)}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
      <AvatarFallback
        className={cn('bg-accent text-accent-foreground font-semibold', FALLBACK_TEXT[size])}
      >
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
