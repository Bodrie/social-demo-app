import type { UserSummary } from '@the-mesh/shared';
import { cn } from 'cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/names';

const ROOT_SIZE = { sm: 'size-8', md: 'size-9', lg: 'size-10', xl: 'size-24' } as const;
const FALLBACK_TEXT = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm', xl: 'text-2xl' } as const;

type UserAvatarProps = {
  user: Pick<UserSummary, 'name' | 'avatarUrl'>;
  size?: keyof typeof ROOT_SIZE;
  className?: string;
};

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  return (
    <Avatar className={cn(ROOT_SIZE[size], className)}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
      <AvatarFallback
        className={cn('bg-accent text-accent-foreground font-semibold', FALLBACK_TEXT[size])}
      >
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
