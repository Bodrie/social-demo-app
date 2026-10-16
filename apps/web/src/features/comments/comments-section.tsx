import {
  COMMENT_MAX_LENGTH,
  type Comment,
  type CommentSort,
  type Post,
  type ReactionType,
} from '@the-mesh/shared';
import { cn } from 'cn';
import { Loader2Icon, MoreHorizontalIcon, PencilIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { EditedMarker } from '@/components/edited-marker';
import { InlineEditor } from '@/components/inline-editor';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { isApiClientError } from '@/lib/api/client';
import { fetchCommentRevisions } from '@/lib/api/comments';
import { queryKeys } from '@/lib/query-keys';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { flattenPages } from '@/lib/infinite';
import { ReactionBar } from './reaction-bar';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useReactToComment,
  useUpdateComment,
} from './use-comments';

const SORTS: { value: CommentSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'top', label: 'Top' },
];

export function CommentsSection({ post }: { post: Post }) {
  const me = useCurrentUser();
  const [sort, setSort] = useState<CommentSort>('newest');
  const comments = useComments(post.id, sort);
  const create = useCreateComment(post.id);
  const remove = useDeleteComment(post.id);
  const update = useUpdateComment(post.id);
  const react = useReactToComment(post.id);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const saveEdit = (comment: Comment, content: string) => {
    update.mutate(
      { commentId: comment.id, input: { content } },
      {
        onSuccess: () => setEditingId(null),
        onError: (error) =>
          toast.error(isApiClientError(error) ? error.message : 'Could not save the comment'),
      },
    );
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

      {post.commentCount > 1 || items.length > 1 ? (
        <fieldset className="flex items-center gap-1">
          <legend className="text-muted-foreground float-left mr-1 text-xs">Sort by</legend>
          {SORTS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              size="xs"
              aria-pressed={sort === option.value}
              className={cn(sort === option.value && 'bg-accent text-accent-foreground')}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </fieldset>
      ) : null}

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
              isAuthor={comment.author.id === me.id}
              canDelete={comment.author.id === me.id || post.author.id === me.id}
              editing={editingId === comment.id}
              saving={update.isPending && update.variables?.commentId === comment.id}
              onEdit={() => setEditingId(comment.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(content) => saveEdit(comment, content)}
              onDelete={() => remove.mutate(comment.id)}
              onReact={(type) =>
                react.mutate({ commentId: comment.id, current: comment.reactions, type })
              }
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

type CommentItemProps = {
  comment: Comment;
  isAuthor: boolean;
  canDelete: boolean;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (content: string) => void;
  onDelete: () => void;
  onReact: (type: ReactionType | null) => void;
};

function CommentItem({
  comment,
  isAuthor,
  canDelete,
  editing,
  saving,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReact,
}: CommentItemProps) {
  const profile = `/u/${comment.author.username}`;
  return (
    <li className="flex gap-3">
      <Link to={profile} aria-hidden="true" tabIndex={-1}>
        <UserAvatar user={comment.author} className="size-8" />
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="bg-muted rounded-lg px-3 py-2">
          <div className="flex items-baseline gap-2">
            <Link to={profile} className="truncate text-sm font-semibold hover:underline">
              {comment.author.name}
            </Link>
            <span className="text-muted-foreground shrink-0 text-xs">
              <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                {formatRelativeTime(comment.createdAt)}
              </time>
              {comment.editedAt ? (
                <>
                  {' · '}
                  <EditedMarker
                    editedAt={comment.editedAt}
                    queryKey={queryKeys.revisions.comment(comment.id)}
                    fetchRevisions={(signal) => fetchCommentRevisions(comment.id, signal)}
                  />
                </>
              ) : null}
            </span>
            {isAuthor || canDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground -mr-1 ml-auto"
                    aria-label="Comment options"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAuthor ? (
                    <DropdownMenuItem onSelect={onEdit}>
                      <PencilIcon /> Edit comment
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                      <Trash2Icon /> Delete comment
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          {editing ? (
            <div className="pt-1">
              <InlineEditor
                initial={comment.content}
                maxLength={COMMENT_MAX_LENGTH}
                label="Edit comment"
                pending={saving}
                submitOnEnter
                onSave={onSaveEdit}
                onCancel={onCancelEdit}
              />
            </div>
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>
        <ReactionBar summary={comment.reactions} onReact={onReact} />
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
