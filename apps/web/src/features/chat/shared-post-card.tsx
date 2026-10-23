import type { SharedPostRef } from '@beso/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { Link } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PostImages } from '@/features/posts/post-images';
import { postQueryOptions } from '@/features/posts/use-posts';
import { formatDateTime, formatRelativeTime } from '@/lib/format';

const FRAME = 'bg-card text-card-foreground w-64 max-w-full rounded-xl border sm:w-72';

/**
 * A post sent to the chat (ADR 0009 amendment 4). The message names it only; the post comes
 * from `GET /posts/:id`, through the post page's cache, so the viewer's own blocks apply and a
 * like given on the page shows here too. Deleted, or kept from this viewer: the empty frame.
 */
export function SharedPostCard({ post: ref }: { post: SharedPostRef }) {
  const id = 'id' in ref ? ref.id : null;
  const query = useInfiniteQuery({ ...postQueryOptions(id ?? ''), enabled: id !== null });
  const post = query.data?.pages[0]?.items[0];

  if (!id || query.isError) {
    return (
      <p
        className={cn(
          FRAME,
          'text-muted-foreground block border-dashed px-3 py-2.5 text-sm italic',
        )}
      >
        This post is unavailable
      </p>
    );
  }
  if (!post) {
    return (
      <div className={cn(FRAME, 'block space-y-2 p-3')} aria-busy="true">
        <span className="sr-only">Loading the post</span>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  return (
    <Link
      to={`/p/${post.id}`}
      className={cn(
        FRAME,
        'hover:bg-accent/40 flex flex-col overflow-hidden p-3 transition-colors',
        'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      {/* The spaces between the parts are for the link's name ("Post by Bob Brown @bob · 2h
          …"); flex layout drops them on screen, where the gaps do the spacing. */}
      <span className="sr-only">Post by</span>{' '}
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <span aria-hidden="true" className="shrink-0">
          <UserAvatar user={post.author} size="sm" className="size-6" />
        </span>{' '}
        <span className="min-w-0 truncate font-semibold">{post.author.name}</span>{' '}
        {/* On a narrow bubble "@username · time" gives way four times as fast as the name. */}
        <span className="text-muted-foreground min-w-0 shrink-[4] truncate text-xs">
          @{post.author.username} ·{' '}
          <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>
            {formatRelativeTime(post.createdAt)}
          </time>
        </span>
      </span>{' '}
      {post.content ? (
        <span className="mt-1.5 line-clamp-4 block text-sm break-words whitespace-pre-wrap">
          {post.content}
        </span>
      ) : null}
      <PostImages
        images={post.images}
        alt={`Posted by ${post.author.name}`}
        maxHeightClass="max-h-48"
        className="mt-2 rounded-md"
      />
    </Link>
  );
}
