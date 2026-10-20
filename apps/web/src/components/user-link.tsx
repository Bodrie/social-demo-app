import type { UserSummary } from '@beso/shared';
import { cn } from 'cn';
import { Link } from 'react-router';

type UserLinkProps = { user: Pick<UserSummary, 'name' | 'username'>; className?: string };

/** The user's name, linking to their profile. */
export function UserLink({ user, className }: UserLinkProps) {
  return (
    <Link to={`/u/${user.username}`} className={cn('font-semibold hover:underline', className)}>
      {user.name}
    </Link>
  );
}
