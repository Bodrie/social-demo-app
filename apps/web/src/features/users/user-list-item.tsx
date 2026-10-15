import type { UserPublic } from '@the-mesh/shared';
import { Link } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { FollowButton } from './follow-button';

export function UserListItem({ user }: { user: UserPublic }) {
  const profile = `/u/${user.username}`;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link to={profile} aria-hidden="true" tabIndex={-1}>
        <UserAvatar user={user} size="lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link to={profile} className="truncate font-semibold hover:underline">
            {user.name}
          </Link>
          {user.followsMe ? (
            <Badge variant="secondary" className="shrink-0">
              Follows you
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground truncate text-sm">
          @{user.username}
          {user.bio ? <span className="text-foreground/80"> · {user.bio}</span> : null}
        </p>
      </div>
      <FollowButton user={user} size="sm" className="shrink-0" />
    </li>
  );
}
