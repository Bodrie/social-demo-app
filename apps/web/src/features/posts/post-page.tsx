import { type CommentSort, commentSortSchema, uuidSchema } from '@beso/shared';
import { FileXIcon } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { NotFoundPage } from '@/features/not-found/not-found-page';
import { isApiClientError } from '@/lib/api/client';
import { flattenPages } from '@/lib/infinite';
import { usePageTitle } from '@/lib/use-page-title';
import { PostCard } from './post-card';
import { PostSkeleton } from './post-skeleton';
import { usePost } from './use-posts';

/** `/p/:postId`: one post with its comments open. `?sort=` and `?comment=` survive in the URL. */
export function PostPage() {
  const params = useParams();
  const parsed = uuidSchema.safeParse(params.postId ?? '');
  return parsed.success ? <PostDetail postId={parsed.data} /> : <NotFoundPage />;
}

function PostDetail({ postId }: { postId: string }) {
  const query = usePost(postId);
  const [search, setSearch] = useSearchParams();
  const sort = commentSortSchema.catch('newest').parse(search.get('sort') ?? 'newest');
  const highlight = search.get('comment');
  const post = flattenPages(query.data)[0];
  usePageTitle(post ? `Post by ${post.author.name}` : 'Post');

  const setSort = (next: CommentSort) =>
    setSearch(
      (previous) => {
        if (next === 'newest') previous.delete('sort');
        else previous.set('sort', next);
        return previous;
      },
      { replace: true },
    );

  if (query.isPending) return <PostSkeleton />;
  if (query.isError && !(isApiClientError(query.error) && query.error.status === 404)) {
    return <ErrorState message="Could not load this post." onRetry={() => void query.refetch()} />;
  }
  if (!post) return <GoneState />;

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Post by {post.author.name}</h1>
      <PostCard
        post={post}
        expanded
        commentSort={sort}
        onCommentSortChange={setSort}
        highlightCommentId={highlight}
      />
    </div>
  );
}

function GoneState() {
  usePageTitle('Post not found');
  return (
    <EmptyState
      icon={FileXIcon}
      title="This post is gone"
      description="It was deleted, or the link never pointed anywhere."
      action={
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      }
    />
  );
}
