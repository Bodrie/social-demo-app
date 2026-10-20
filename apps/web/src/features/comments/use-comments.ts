import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Comment,
  CommentSort,
  CreateCommentInput,
  ReactionSummary,
  ReactionType,
  UpdateCommentInput,
} from '@beso/shared';
import { toast } from 'sonner';
import { updatePostEverywhere } from '@/features/posts/post-cache';
import {
  clearReaction,
  createComment,
  deleteComment,
  fetchComment,
  fetchComments,
  fetchReplies,
  setReaction,
  updateComment,
} from '@/lib/api/comments';
import {
  NO_CURSOR,
  type Pages,
  appendItem,
  filterItems,
  flattenPages,
  mapItems,
  prependItem,
} from '@/lib/infinite';
import { holdQueries, resumeQueries, runningToggles } from '@/lib/optimistic';
import { queryKeys } from '@/lib/query-keys';
import { withMyReaction } from './reactions';

type CommentPages = Pages<Comment>;
type QueryClient = ReturnType<typeof useQueryClient>;

export const commentsQueryOptions = (postId: string, sort: CommentSort) =>
  infiniteQueryOptions({
    queryKey: queryKeys.comments.forPost(postId, sort),
    queryFn: ({ pageParam, signal }) => fetchComments(postId, { cursor: pageParam, sort, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export function useComments(postId: string, sort: CommentSort) {
  return useInfiniteQuery(commentsQueryOptions(postId, sort));
}

/** The replies under a top-level comment, oldest first; fetched once the thread is unfolded. */
export function useReplies(commentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.comments.replies(commentId),
    queryFn: ({ pageParam, signal }) => fetchReplies(commentId, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

/** A highlighted comment that is not among the loaded pages; `enabled` false skips the request. */
export function useComment(commentId: string | null, enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: queryKeys.comments.single(commentId ?? ''),
      queryFn: ({ signal }) => fetchComment(commentId ?? '', signal),
      enabled: enabled && commentId !== null,
      retry: false,
    }),
  );
}

/**
 * Applies `update` to one comment wherever it is cached: every sort order of its post, every
 * thread of replies (a reply lives there) and a copy pinned from a permalink.
 */
function updateCommentEverywhere(
  queryClient: QueryClient,
  postId: string,
  commentId: string,
  update: (comment: Comment) => Comment,
): void {
  const inPages = (data: CommentPages | undefined) =>
    data && mapItems(data, (item) => (item.id === commentId ? update(item) : item));
  queryClient.setQueriesData<CommentPages>(
    { queryKey: queryKeys.comments.ofPost(postId) },
    inPages,
  );
  queryClient.setQueriesData<CommentPages>({ queryKey: queryKeys.comments.allReplies }, inPages);
  // A comment pinned from a permalink lives outside the post's lists (review, contract #1).
  queryClient.setQueryData<Comment>(
    queryKeys.comments.single(commentId),
    (comment) => comment && update(comment),
  );
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(postId, input),
    onSuccess: (comment) => {
      if (comment.parentId === null) {
        // Newest-first lists show it at once; a ranked list would put a zero-reaction comment
        // in the wrong place, so that one is refetched instead.
        queryClient.setQueryData<CommentPages>(
          queryKeys.comments.forPost(postId, 'newest'),
          (data) => data && prependItem(data, comment),
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.comments.forPost(postId, 'top') });
      } else {
        // A reply joins the end of its thread and counts on its parent.
        const parentId = comment.parentId;
        queryClient.setQueryData<CommentPages>(
          queryKeys.comments.replies(parentId),
          (data) => data && appendItem(data, comment),
        );
        updateCommentEverywhere(queryClient, postId, parentId, (parent) => ({
          ...parent,
          replyCount: parent.replyCount + 1,
        }));
      }
      updatePostEverywhere(queryClient, postId, (post) => ({
        ...post,
        commentCount: post.commentCount + 1,
      }));
    },
  });
}

export function useUpdateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: UpdateCommentInput }) =>
      updateComment(commentId, input),
    onSuccess: (comment) => {
      updateCommentEverywhere(queryClient, postId, comment.id, () => comment);
      void queryClient.invalidateQueries({ queryKey: queryKeys.revisions.comment(comment.id) });
    },
  });
}

/** Takes the whole comment: a deleted top-level comment takes its replies with it. */
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (comment: Comment) => deleteComment(comment.id),
    onSuccess: (_result, comment) => {
      const without = (data: CommentPages | undefined) =>
        data && filterItems(data, (item) => item.id !== comment.id);
      if (comment.parentId === null) {
        queryClient.setQueriesData<CommentPages>(
          { queryKey: queryKeys.comments.ofPost(postId) },
          without,
        );
        queryClient.removeQueries({ queryKey: queryKeys.comments.replies(comment.id) });
      } else {
        queryClient.setQueryData<CommentPages>(
          queryKeys.comments.replies(comment.parentId),
          without,
        );
        updateCommentEverywhere(queryClient, postId, comment.parentId, (parent) => ({
          ...parent,
          replyCount: Math.max(0, parent.replyCount - 1),
        }));
      }
      queryClient.removeQueries({ queryKey: queryKeys.comments.single(comment.id) });
      const gone = 1 + comment.replyCount;
      updatePostEverywhere(queryClient, postId, (post) => ({
        ...post,
        commentCount: Math.max(0, post.commentCount - gone),
      }));
    },
    onError: () => toast.error('Could not delete the comment'),
  });
}

type ReactInput = { commentId: string; current: ReactionSummary; type: ReactionType | null };
const REACT_KEY = ['comments', 'react'] as const;

/** Every cached list (sort orders of the post, threads of replies) that shows the comment, or has nothing yet. */
function commentListKeysShowing(queryClient: QueryClient, postId: string, commentId: string) {
  return [
    ...queryClient.getQueriesData<CommentPages>({ queryKey: queryKeys.comments.ofPost(postId) }),
    ...queryClient.getQueriesData<CommentPages>({ queryKey: queryKeys.comments.allReplies }),
  ]
    .filter(([, data]) => !data || flattenPages(data).some((comment) => comment.id === commentId))
    .map(([queryKey]) => queryKey);
}

/**
 * Optimistic: counts, total and "mine" flip at once and the server summary replaces them.
 * Only this comment is touched, so reactions to other comments in flight keep theirs.
 */
export function useReactToComment(postId: string) {
  const queryClient = useQueryClient();
  const setMine = (commentId: string, type: ReactionType | null) =>
    updateCommentEverywhere(queryClient, postId, commentId, (comment) => ({
      ...comment,
      reactions: withMyReaction(comment.reactions, type),
    }));
  return useMutation({
    mutationKey: REACT_KEY,
    mutationFn: ({ commentId, type }: ReactInput) =>
      type ? setReaction(commentId, type) : clearReaction(commentId),
    onMutate: async ({ commentId, type }) => {
      const interrupted = await holdQueries(
        queryClient,
        commentListKeysShowing(queryClient, postId, commentId),
      );
      setMine(commentId, type);
      return { interrupted };
    },
    onSuccess: (summary, { commentId }) => {
      // A newer reaction to the same comment is still on its way: its answer is the final one.
      if (runningToggles(queryClient, REACT_KEY, { commentId }) > 1) return;
      updateCommentEverywhere(queryClient, postId, commentId, (comment) => ({
        ...comment,
        reactions: summary,
      }));
    },
    onError: (_error, { commentId, current }) => {
      const showing = commentListKeysShowing(queryClient, postId, commentId);
      setMine(commentId, current.mine);
      for (const queryKey of showing) void queryClient.invalidateQueries({ queryKey, exact: true });
      toast.error('Could not save the reaction');
    },
    onSettled: (_result, _error, _input, context) =>
      resumeQueries(queryClient, context?.interrupted ?? []),
  });
}
