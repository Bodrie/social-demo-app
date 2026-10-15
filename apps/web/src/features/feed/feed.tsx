import { PostList } from '@/features/posts/post-list';
import { useFeed } from '@/features/posts/use-posts';

export function Feed() {
  return (
    <PostList
      query={useFeed()}
      label="Posts"
      errorMessage="Could not load your feed."
      empty={{
        title: 'Your feed is empty',
        description: 'Follow people to see their posts here, or write the first one yourself.',
      }}
    />
  );
}
