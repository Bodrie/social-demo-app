import type { UserPublic } from '@beso/shared';
import { UserCheckIcon, UserPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/current-user';
import { useToggleFollow } from './use-follow';

type FollowButtonProps = {
  user: Pick<UserPublic, 'id' | 'followedByMe'>;
  size?: 'sm' | 'default';
  className?: string;
  /** The word while not following, e.g. "Follow back" on an invite's notification (F1). */
  followLabel?: string;
};

/** Follow / Following toggle; renders nothing for the viewer's own profile. */
export function FollowButton({
  user,
  size = 'default',
  className,
  followLabel = 'Follow',
}: FollowButtonProps) {
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
      {following ? 'Following' : followLabel}
    </Button>
  );
}
