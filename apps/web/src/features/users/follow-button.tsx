import type { UserPublic } from '@the-mesh/shared';
import { UserCheckIcon, UserPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/current-user';
import { useToggleFollow } from './use-follow';

type FollowButtonProps = {
  user: Pick<UserPublic, 'id' | 'followedByMe'>;
  size?: 'sm' | 'default';
  className?: string;
};

/** Follow / Following toggle; renders nothing for the viewer's own profile. */
export function FollowButton({ user, size = 'default', className }: FollowButtonProps) {
  const me = useCurrentUser();
  const toggle = useToggleFollow();
  if (user.id === me.id) return null;
  const following = user.followedByMe;
  return (
    <Button
      size={size}
      variant={following ? 'outline' : 'default'}
      aria-pressed={following}
      className={className}
      onClick={() => toggle.mutate({ userId: user.id, following })}
    >
      {following ? <UserCheckIcon /> : <UserPlusIcon />}
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
