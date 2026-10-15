import type { UserSummary } from '@the-mesh/shared';
import { cn } from 'cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/names';

type UserAvatarProps = {
  user: Pick<UserSummary, 'name' | 'avatarUrl'>;
  className?: string;
};

export function UserAvatar({ user, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('size-9', className)}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
