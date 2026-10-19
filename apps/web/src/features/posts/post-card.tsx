import { POST_MAX_LENGTH, type Post } from '@the-mesh/shared';
import { cn } from 'cn';
import { HeartIcon, MessageCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { EditedMarker } from '@/components/edited-marker';
import { InlineEditor } from '@/components/inline-editor';
import { RichText } from '@/components/rich-text';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/current-user';
import { CommentsSection } from '@/features/comments/comments-section';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { PostMenu } from './post-menu';
import { useToggleLike, useUpdatePost } from './use-post-mutations';
import { isApiClientError } from '@/lib/api/client';
import { fetchPostRevisions } from '@/lib/api/posts';
import { queryKeys } from '@/lib/query-keys';

export function PostCard({ post }: { post: Post }) {
  const me = useCurrentUser();
  const toggleLike = useToggleLike();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const update = useUpdatePost();
  const profile = `/u/${post.author.username}`;
  const headingId = `post-${post.id}-author`;

  return (
    <article
      aria-labelledby={headingId}
      className="bg-card text-card-foreground rounded-xl border shadow-sm"
    >
      <header className="flex items-start gap-3 px-5 pt-5">
        <Link to={profile} aria-hidden="true" tabIndex={-1}>
          <UserAvatar user={post.author} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            id={headingId}
            to={profile}
            className="block truncate font-semibold hover:underline"
          >
            {post.author.name}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            @{post.author.username} ·{' '}
            <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </time>
            {post.editedAt ? (
              <>
                {' · '}
                <EditedMarker
                  editedAt={post.editedAt}
                  queryKey={queryKeys.revisions.post(post.id)}
                  fetchRevisions={(signal) => fetchPostRevisions(post.id, signal)}
                />
              </>
            ) : null}
          </p>
        </div>
        {post.author.id === me.id ? <PostMenu post={post} onEdit={() => setEditing(true)} /> : null}
      </header>

      <div className="px-5 pt-3">
        {editing ? (
          <InlineEditor
            initial={post.content}
            maxLength={POST_MAX_LENGTH}
            label="Edit post"
            pending={update.isPending}
            onSave={(content) =>
              update.mutate(
                { postId: post.id, input: { content } },
                {
                  onSuccess: () => setEditing(false),
                  onError: (error) =>
                    toast.error(
                      isApiClientError(error) ? error.message : 'Could not save the post',
                    ),
                },
              )
            }
            onCancel={() => setEditing(false)}
          />
        ) : (
          <RichText
            text={post.content}
            mentions={post.mentions}
            hashtags
            className="text-[15px]/6 break-words whitespace-pre-wrap"
          />
        )}
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={`Posted by ${post.author.name}`}
            loading="lazy"
            decoding="async"
            className="mt-3 max-h-[32rem] w-full rounded-lg border object-cover"
          />
        ) : null}
      </div>

      <footer className="flex items-center gap-1 px-3 pt-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={post.likedByMe}
          className={cn('gap-1.5', post.likedByMe && 'text-like hover:text-like')}
          onClick={() => toggleLike.mutate({ postId: post.id, liked: post.likedByMe })}
        >
          <HeartIcon className={cn(post.likedByMe && 'fill-current')} />
          <span className="sr-only">{post.likedByMe ? 'Unlike' : 'Like'}</span>{' '}
          <span className="tabular-nums">{post.likeCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={commentsOpen}
          className={cn('gap-1.5', commentsOpen && 'text-primary')}
          onClick={() => setCommentsOpen((open) => !open)}
        >
          <MessageCircleIcon />
          <span className="sr-only">Comments</span>{' '}
          <span className="tabular-nums">{post.commentCount}</span>
        </Button>
      </footer>

      {commentsOpen ? <CommentsSection post={post} /> : null}
    </article>
  );
}
