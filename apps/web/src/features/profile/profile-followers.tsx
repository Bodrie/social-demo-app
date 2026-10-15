import { UserList } from '@/features/users/user-list';
import { useFollowers, useFollowing } from '@/features/users/use-users';
import { firstName } from '@/lib/names';
import { useProfileContext } from './profile-context';

export function ProfileFollowers() {
  const { user } = useProfileContext();
  return (
    <UserList
      query={useFollowers(user.id)}
      label="Followers"
      errorMessage="Could not load the followers."
      empty={{
        title: 'No followers yet',
        description: `Nobody follows ${firstName(user.name)} so far.`,
      }}
    />
  );
}

export function ProfileFollowing() {
  const { user } = useProfileContext();
  return (
    <UserList
      query={useFollowing(user.id)}
      label="Following"
      errorMessage="Could not load who they follow."
      empty={{
        title: 'Not following anyone',
        description: `${firstName(user.name)} does not follow anyone yet.`,
      }}
    />
  );
}
