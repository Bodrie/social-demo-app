import { useInfiniteQuery } from '@tanstack/react-query';
import { PostList } from '@/features/posts/post-list';
import { PostListSkeleton } from '@/features/posts/post-skeleton';
import { postQueryOptions, useUserPosts } from '@/features/posts/use-posts';
import { useCurrentUser } from '@/features/auth/current-user';
import { firstName } from '@/lib/names';
import { useProfileContext } from './profile-context';

export function ProfilePosts() {
  const { user } = useProfileContext();
  const me = useCurrentUser();
  const isMe = user.id === me.id;
  const posts = useUserPosts(user.id);
  // The pinned post comes through its own query (the post page's cache), so a like on either
  // shows on both; a pin that no longer resolves (deleted meanwhile) is simply not shown.
  const pinnedId = (isMe ? me.pinnedPostId : user.pinnedPostId) ?? null;
  const pinned = useInfiniteQuery({ ...postQueryOptions(pinnedId ?? ''), enabled: !!pinnedId });
  if (pinnedId && pinned.isPending) return <PostListSkeleton />;
  return (
    <PostList
      query={posts}
      pinned={pinnedId ? pinned.data?.pages[0]?.items[0] : undefined}
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
