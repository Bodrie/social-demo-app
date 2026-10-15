import { PostList } from '@/features/posts/post-list';
import { useUserPosts } from '@/features/posts/use-posts';
import { useCurrentUser } from '@/features/auth/current-user';
import { firstName } from '@/lib/names';
import { useProfileContext } from './profile-context';

export function ProfilePosts() {
  const { user } = useProfileContext();
  const me = useCurrentUser();
  const isMe = user.id === me.id;
  return (
    <PostList
      query={useUserPosts(user.id)}
      label={`Posts by ${user.name}`}
      errorMessage="Could not load these posts."
      empty={{
        title: 'No posts yet',
        description: isMe
          ? 'Your posts will show up here. Share something from the home page.'
          : `${firstName(user.name)} has not posted anything yet.`,
      }}
    />
  );
}
