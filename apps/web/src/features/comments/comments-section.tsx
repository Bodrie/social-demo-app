import type { Comment, Post } from '@the-mesh/shared';
import { Loader2Icon, SendIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { isApiClientError } from '@/lib/api/client';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { flattenPages } from '@/lib/infinite';
import { useComments, useCreateComment, useDeleteComment } from './use-comments';

export function CommentsSection({ post }: { post: Post }) {
  const me = useCurrentUser();
  const comments = useComments(post.id);
  const create = useCreateComment(post.id);
  const remove = useDeleteComment(post.id);
  const [text, setText] = useState('');
  const items = flattenPages(comments.data);
  const canSend = text.trim().length > 0 && !create.isPending;

  const send = () => {
    if (!canSend) return;
    create.mutate(
      { content: text.trim() },
      {
        onSuccess: () => setText(''),
        onError: (error) =>
          toast.error(isApiClientError(error) ? error.message : 'Could not add the comment'),
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <section aria-label="Comments" className="space-y-4 border-t px-5 py-4">
      <form onSubmit={onSubmit} className="flex items-start gap-3">
        <UserAvatar user={me} className="size-8" />
        <Textarea
          aria-label="Write a comment"
          placeholder="Write a comment…"
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-9 py-1.5 text-sm"
        />
        <Button type="submit" size="icon-sm" aria-label="Send comment" disabled={!canSend}>
          {create.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
        </Button>
      </form>

      {comments.isPending ? (
        <CommentListSkeleton />
      ) : comments.isError ? (
        <p className="text-destructive text-sm">
          Could not load the comments.{' '}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void comments.refetch()}
          >
            Try again
          </Button>
        </p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canDelete={comment.author.id === me.id || post.author.id === me.id}
              onDelete={() => remove.mutate(comment.id)}
            />
          ))}
        </ul>
      )}

      {comments.hasNextPage ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          disabled={comments.isFetchingNextPage}
          onClick={() => void comments.fetchNextPage()}
        >
          {comments.isFetchingNextPage ? 'Loading…' : 'Show older comments'}
        </Button>
      ) : null}
    </section>
  );
}

type CommentItemProps = { comment: Comment; canDelete: boolean; onDelete: () => void };

function CommentItem({ comment, canDelete, onDelete }: CommentItemProps) {
  const profile = `/u/${comment.author.username}`;
  return (
    <li className="flex gap-3">
      <Link to={profile} aria-hidden="true" tabIndex={-1}>
        <UserAvatar user={comment.author} className="size-8" />
      </Link>
      <div className="bg-muted min-w-0 flex-1 rounded-lg px-3 py-2">
        <div className="flex items-baseline gap-2">
          <Link to={profile} className="truncate text-sm font-semibold hover:underline">
            {comment.author.name}
          </Link>
          <time
            dateTime={comment.createdAt}
            title={formatDateTime(comment.createdAt)}
            className="text-muted-foreground shrink-0 text-xs"
          >
            {formatRelativeTime(comment.createdAt)}
          </time>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive ml-auto -mr-1"
              aria-label="Delete comment"
              onClick={onDelete}
            >
              <Trash2Icon />
            </Button>
          ) : null}
        </div>
        <p className="text-sm break-words whitespace-pre-wrap">{comment.content}</p>
      </div>
    </li>
  );
}

function CommentListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1].map((index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-12 flex-1 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
