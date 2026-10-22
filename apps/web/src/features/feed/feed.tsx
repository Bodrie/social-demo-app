import { CompassIcon, UsersIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
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
        description:
          'It fills with the posts of the people you follow. See what everyone is posting, or find people you know.',
        // A newcomer's first screen (F1): the way to the rest of the network.
        action: (
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/explore">
                <CompassIcon /> Explore
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/users">
                <UsersIcon /> Find people
              </Link>
            </Button>
          </div>
        ),
      }}
    />
  );
}
