import {
  COMMENT_MAX_LENGTH,
  type Comment,
  type CommentSort,
  type Post,
  type ReactionType,
  type UserSummary,
} from '@beso/shared';
import { cn } from 'cn';
import {
  CornerDownRightIcon,
  FlagIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { EditedMarker } from '@/components/edited-marker';
import { InlineEditor } from '@/components/inline-editor';
import { LongPressArea } from '@/components/long-press-area';
import { MentionTextarea } from '@/components/mention-textarea';
import { RichText } from '@/components/rich-text';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { isApiClientError } from '@/lib/api/client';
import { fetchCommentRevisions } from '@/lib/api/comments';
import { focusLater } from '@/lib/focus';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { flattenPages } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';
import { ReactionBar } from './reaction-bar';
import {
  useComment,
  useComments,
  useCreateComment,
  useDeleteComment,
  useReactToComment,
  useReplies,
  useUpdateComment,
} from './use-comments';

// Reporting is rare: the dialog loads when it is first opened, not with the feed's first paint.
const ReportDialog = lazy(() =>
  import('@/features/moderation/report-dialog').then((module) => ({
    default: module.ReportDialog,
  })),
);

const SORTS: { value: CommentSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'top', label: 'Top' },
];

/** Where the next reply goes: under `parentId`, starting with `prefill` (the person answered). */
type ReplyTarget = { parentId: string; prefill: string };

const repliesLabel = (count: number) => `View ${count} ${count === 1 ? 'reply' : 'replies'}`;

type CommentsSectionProps = {
  post: Post;
  /** Controlled sort; without it the section keeps its own. */
  sort?: CommentSort;
  onSortChange?: (sort: CommentSort) => void;
  /** Rings this comment; fetched alone when it is not among the loaded pages. */
  highlightId?: string | null;
};

export function CommentsSection({
  post,
  sort: controlledSort,
  onSortChange,
  highlightId = null,
}: CommentsSectionProps) {
  const me = useCurrentUser();
  const [ownSort, setOwnSort] = useState<CommentSort>('newest');
  const sort = controlledSort ?? ownSort;
  const setSort = onSortChange ?? setOwnSort;
  const comments = useComments(post.id, sort);
  const create = useCreateComment(post.id);
  const [text, setText] = useState('');
  // One editor and one reply composer open at a time, across every thread.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const loaded = flattenPages(comments.data);
  const highlightLoaded = highlightId !== null && loaded.some((c) => c.id === highlightId);
  // Past the loaded pages (or on another sort order): fetch the one comment and pin it on top.
  const single = useComment(highlightId, comments.isSuccess && !highlightLoaded);
  // A highlighted reply needs its thread on screen: its parent is pinned the same way.
  const parentId = single.data?.parentId ?? null;
  const parentLoaded = parentId !== null && loaded.some((c) => c.id === parentId);
  const parent = useComment(parentId, single.isSuccess && !parentLoaded);
  const pinned = [single.data, parent.data].filter(
    (c): c is Comment =>
      c !== undefined && c.parentId === null && !loaded.some((item) => item.id === c.id),
  );
  const items = [...pinned, ...loaded];
  const highlightedReply = single.data && single.data.parentId !== null ? single.data : null;
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
        <MentionTextarea
          ref={composerRef}
          aria-label="Write a comment"
          placeholder="Write a comment…"
          rows={1}
          value={text}
          onValueChange={setText}
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
            <CommentThread
              key={comment.id}
              comment={comment}
              post={post}
              me={me}
              highlightId={highlightId}
              pinnedReply={highlightedReply?.parentId === comment.id ? highlightedReply : null}
              editingId={editingId}
              onEditingChange={setEditingId}
              replyTo={replyTo?.parentId === comment.id ? replyTo : null}
              onReplyToChange={setReplyTo}
              composerRef={composerRef}
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

type CommentThreadProps = {
  comment: Comment;
  post: Post;
  me: UserSummary;
  highlightId: string | null;
  /** A highlighted reply of this thread that may lie past its loaded pages. */
  pinnedReply: Comment | null;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  replyTo: ReplyTarget | null;
  onReplyToChange: (target: ReplyTarget | null) => void;
  /** The section's composer: where focus goes when the top-level comment is deleted. */
  composerRef: RefObject<HTMLTextAreaElement | null>;
};

/** A top-level comment with its replies (one level), the "View replies" fold and the reply composer. */
function CommentThread({
  comment,
  post,
  me,
  highlightId,
  pinnedReply,
  editingId,
  onEditingChange,
  replyTo,
  onReplyToChange,
  composerRef,
}: CommentThreadProps) {
  const update = useUpdateComment(post.id);
  const remove = useDeleteComment(post.id);
  const react = useReactToComment(post.id);
  // Folded by default; a highlighted reply unfolds it; "Hide replies" is remembered.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const unfolded = replyTo !== null || (toggled ?? pinnedReply !== null);
  const replies = useReplies(comment.id, unfolded && comment.replyCount > 0);
  const loadedReplies = flattenPages(replies.data);
  const replyItems =
    pinnedReply && !loadedReplies.some((reply) => reply.id === pinnedReply.id)
      ? [pinnedReply, ...loadedReplies]
      : loadedReplies;
  const replyButtonRef = useRef<HTMLButtonElement>(null);

  const toggleReplies = () => {
    if (unfolded) onReplyToChange(null);
    setToggled(!unfolded);
  };

  const saveEdit = (target: Comment, content: string) => {
    update.mutate(
      { commentId: target.id, input: { content } },
      {
        onSuccess: () => onEditingChange(null),
        onError: (error) =>
          toast.error(isApiClientError(error) ? error.message : 'Could not save the comment'),
      },
    );
  };

  const itemProps = (target: Comment) => ({
    highlighted: target.id === highlightId,
    isAuthor: target.author.id === me.id,
    canDelete: target.author.id === me.id || post.author.id === me.id,
    editing: editingId === target.id,
    saving: update.isPending && update.variables?.commentId === target.id,
    onEdit: () => onEditingChange(target.id),
    onCancelEdit: () => onEditingChange(null),
    onSaveEdit: (content: string) => saveEdit(target, content),
    onReact: (type: ReactionType | null) =>
      react.mutate({ commentId: target.id, current: target.reactions, type }),
  });

  return (
    <CommentItem
      comment={comment}
      {...itemProps(comment)}
      // The deleted item took the focused menu with it; the composer is the next stop.
      onDelete={() => remove.mutate(comment, { onSuccess: () => focusLater(composerRef) })}
      onReply={() => onReplyToChange({ parentId: comment.id, prefill: '' })}
      replyButtonRef={replyButtonRef}
      footer={
        comment.replyCount > 0 ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            aria-expanded={unfolded}
            onClick={toggleReplies}
          >
            <CornerDownRightIcon aria-hidden="true" />
            {unfolded ? 'Hide replies' : repliesLabel(comment.replyCount)}
          </Button>
        ) : null
      }
    >
      {unfolded ? (
        <div className="space-y-2 pt-1">
          {replies.isError ? (
            <p className="text-destructive text-sm">
              Could not load the replies.{' '}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => void replies.refetch()}
              >
                Try again
              </Button>
            </p>
          ) : replies.isPending && comment.replyCount > 0 ? (
            <CommentListSkeleton compact />
          ) : replyItems.length > 0 ? (
            <ul aria-label="Replies" className="space-y-2">
              {replyItems.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  compact
                  {...itemProps(reply)}
                  onDelete={() =>
                    remove.mutate(reply, { onSuccess: () => focusLater(replyButtonRef) })
                  }
                  // Answering a reply stays in the same thread and names the person answered.
                  onReply={() =>
                    onReplyToChange({
                      parentId: comment.id,
                      prefill: reply.author.id === me.id ? '' : `@${reply.author.username} `,
                    })
                  }
                />
              ))}
            </ul>
          ) : null}
          {replies.hasNextPage ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              disabled={replies.isFetchingNextPage}
              onClick={() => void replies.fetchNextPage()}
            >
              {replies.isFetchingNextPage ? 'Loading…' : 'Show more replies'}
            </Button>
          ) : null}
          {replyTo ? (
            <ReplyComposer
              key={replyTo.prefill}
              postId={post.id}
              parentId={replyTo.parentId}
              prefill={replyTo.prefill}
              me={me}
              // Sent: the thread stays open so the reply is seen. Either way focus goes back
              // to the button that opened the composer.
              onSent={() => setToggled(true)}
              onClose={() => {
                onReplyToChange(null);
                focusLater(replyButtonRef);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </CommentItem>
  );
}

type ReplyComposerProps = {
  postId: string;
  parentId: string;
  prefill: string;
  me: UserSummary;
  onSent: () => void;
  onClose: () => void;
};

function ReplyComposer({ postId, parentId, prefill, me, onSent, onClose }: ReplyComposerProps) {
  const create = useCreateComment(postId);
  const [text, setText] = useState(prefill);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Opened on purpose from a "Reply" button: typing can start right away, after the prefill.
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);
  const canSend = text.trim().length > 0 && !create.isPending;

  const send = () => {
    if (!canSend) return;
    create.mutate(
      { content: text.trim(), parentId },
      {
        onSuccess: () => {
          onSent();
          onClose();
        },
        onError: (error) =>
          toast.error(isApiClientError(error) ? error.message : 'Could not add the reply'),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="flex items-start gap-2"
    >
      <UserAvatar user={me} className="size-6" />
      <MentionTextarea
        ref={ref}
        aria-label="Write a reply"
        placeholder="Write a reply…"
        rows={1}
        value={text}
        onValueChange={setText}
        onKeyDown={onKeyDown}
        className="min-h-8 py-1 text-sm"
      />
      <Button type="submit" size="icon-sm" aria-label="Send reply" disabled={!canSend}>
        {create.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel reply"
        onClick={onClose}
      >
        <XIcon />
      </Button>
    </form>
  );
}

type CommentItemProps = {
  comment: Comment;
  /** A reply: smaller avatar, no fold of its own. */
  compact?: boolean;
  highlighted: boolean;
  isAuthor: boolean;
  canDelete: boolean;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (content: string) => void;
  onDelete: () => void;
  onReact: (type: ReactionType | null) => void;
  onReply: () => void;
  replyButtonRef?: RefObject<HTMLButtonElement | null>;
  /** Next to the reactions: the "View replies" fold. */
  footer?: ReactNode;
  /** Under the comment: its replies and the composer. */
  children?: ReactNode;
};

/**
 * The comment's own controls (menu, reaction picker): on fine pointers they appear while the
 * comment is hovered, holds keyboard focus or has a menu open; touch screens have none and
 * use the press-and-hold instead (`pointer-coarse:hidden` sits on the controls themselves).
 */
const REVEAL_ON_HOVER =
  'pointer-coarse:hidden opacity-0 group-hover/comment:opacity-100 group-has-[:focus-visible]/comment:opacity-100 data-[state=open]:opacity-100';

function CommentItem({
  comment,
  compact = false,
  highlighted,
  isAuthor,
  canDelete,
  editing,
  saving,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReact,
  onReply,
  replyButtonRef,
  footer,
  children,
}: CommentItemProps) {
  const profile = `/u/${comment.author.username}`;
  const itemRef = useRef<HTMLLIElement>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);
  const [reporting, setReporting] = useState(false);
  // A press-and-hold on the comment opens the reaction picker over it, as native apps do.
  const [pressedOn, setPressedOn] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (highlighted && typeof itemRef.current?.scrollIntoView === 'function') {
      itemRef.current.scrollIntoView({ block: 'center' });
    }
  }, [highlighted]);
  // When the editor closes, focus returns to the menu that opened it.
  const wasEditing = useRef(editing);
  useEffect(() => {
    if (wasEditing.current && !editing) focusLater(optionsRef);
    wasEditing.current = editing;
  }, [editing]);
  return (
    <li
      ref={itemRef}
      id={`comment-${comment.id}`}
      data-highlighted={highlighted || undefined}
      className="flex gap-3"
    >
      <Link to={profile} aria-hidden="true" tabIndex={-1}>
        <UserAvatar user={comment.author} className={compact ? 'size-6' : 'size-8'} />
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* The group ends before the replies, so hovering one does not reveal this comment's controls. */}
        <div className="group/comment space-y-1.5">
          <LongPressArea
            onLongPress={setPressedOn}
            className={cn(
              'bg-muted rounded-lg px-3 py-2',
              highlighted && 'ring-primary/50 ring-2 ring-offset-2 ring-offset-card',
            )}
          >
            <div className="flex items-baseline gap-2">
              <Link to={profile} className="truncate text-sm font-semibold hover:underline">
                {comment.author.name}
              </Link>
              <span className="text-muted-foreground shrink-0 text-xs">
                <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                  {formatRelativeTime(comment.createdAt)}
                  <span className="sr-only"> ({formatDateTime(comment.createdAt)})</span>
                </time>
                {comment.editedAt ? (
                  <>
                    {' · '}
                    <EditedMarker
                      editedAt={comment.editedAt}
                      queryKey={queryKeys.revisions.comment(comment.id)}
                      fetchRevisions={(options) => fetchCommentRevisions(comment.id, options)}
                    />
                  </>
                ) : null}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    ref={optionsRef}
                    variant="ghost"
                    size="icon-xs"
                    className={cn('text-muted-foreground -mr-1 ml-auto', REVEAL_ON_HOVER)}
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
                  ) : (
                    <DropdownMenuItem onSelect={() => setReporting(true)}>
                      <FlagIcon /> Report comment
                    </DropdownMenuItem>
                  )}
                  {canDelete ? (
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                      <Trash2Icon /> Delete comment
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              {reporting ? (
                <Suspense fallback={null}>
                  <ReportDialog
                    target={{ type: 'comment', id: comment.id }}
                    open={reporting}
                    onOpenChange={setReporting}
                    returnFocusTo={() => optionsRef.current?.focus()}
                  />
                </Suspense>
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
              <RichText
                text={comment.content}
                mentions={comment.mentions}
                hashtags
                className="text-sm break-words whitespace-pre-wrap"
              />
            )}
          </LongPressArea>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ReactionBar
              summary={comment.reactions}
              onReact={onReact}
              pickerClassName={REVEAL_ON_HOVER}
              pressedOn={pressedOn}
              onClose={() => setPressedOn(null)}
              actions={[
                isAuthor
                  ? { label: 'Edit comment', icon: <PencilIcon />, onSelect: onEdit }
                  : {
                      label: 'Report comment',
                      icon: <FlagIcon />,
                      onSelect: () => setReporting(true),
                    },
                ...(canDelete
                  ? [
                      {
                        label: 'Delete comment',
                        icon: <Trash2Icon />,
                        destructive: true,
                        onSelect: onDelete,
                      },
                    ]
                  : []),
              ]}
            />
            <Button
              ref={replyButtonRef}
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={onReply}
            >
              Reply
            </Button>
            {footer}
          </div>
        </div>
        {children}
      </div>
    </li>
  );
}

function CommentListSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1].map((index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className={cn('rounded-full', compact ? 'size-6' : 'size-8')} />
          <Skeleton className={cn('flex-1 rounded-lg', compact ? 'h-10' : 'h-12')} />
        </div>
      ))}
    </div>
  );
}
