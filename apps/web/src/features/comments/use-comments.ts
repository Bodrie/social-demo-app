import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Comment,
  CommentSort,
  CreateCommentInput,
  ReactionSummary,
  ReactionType,
  UpdateCommentInput,
} from '@the-mesh/shared';
import { toast } from 'sonner';
import { updatePostEverywhere } from '@/features/posts/post-cache';
import {
  clearReaction,
  createComment,
  deleteComment,
  fetchComments,
  setReaction,
  updateComment,
} from '@/lib/api/comments';
import { NO_CURSOR, type Pages, filterItems, mapItems, prependItem } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';
import { restoreQueries, snapshotQueries } from '@/lib/query-snapshot';
import { withMyReaction } from './reactions';

type CommentPages = Pages<Comment>;

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

/** Applies `update` to one comment in every cached sort order of its post. */
function updateCommentEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  commentId: string,
  update: (comment: Comment) => Comment,
): void {
  queryClient.setQueriesData<CommentPages>(
    { queryKey: queryKeys.comments.ofPost(postId) },
    (data) => data && mapItems(data, (item) => (item.id === commentId ? update(item) : item)),
  );
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(postId, input),
    onSuccess: (comment) => {
      // Newest-first lists show it at once; a ranked list would put a zero-reaction comment
      // in the wrong place, so that one is refetched instead.
      queryClient.setQueryData<CommentPages>(
        queryKeys.comments.forPost(postId, 'newest'),
        (data) => data && prependItem(data, comment),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments.forPost(postId, 'top') });
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

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_result, commentId) => {
      queryClient.setQueriesData<CommentPages>(
        { queryKey: queryKeys.comments.ofPost(postId) },
        (data) => data && filterItems(data, (comment) => comment.id !== commentId),
      );
      updatePostEverywhere(queryClient, postId, (post) => ({
        ...post,
        commentCount: Math.max(0, post.commentCount - 1),
      }));
    },
    onError: () => toast.error('Could not delete the comment'),
  });
}

type ReactInput = { commentId: string; current: ReactionSummary; type: ReactionType | null };

/** Optimistic: counts, total and "mine" flip at once; the server summary replaces them. */
export function useReactToComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, type }: ReactInput) =>
      type ? setReaction(commentId, type) : clearReaction(commentId),
    onMutate: async ({ commentId, current, type }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.comments.ofPost(postId) });
      const snapshot = snapshotQueries(queryClient, {
        queryKey: queryKeys.comments.ofPost(postId),
      });
      updateCommentEverywhere(queryClient, postId, commentId, (comment) => ({
        ...comment,
        reactions: withMyReaction(current, type),
      }));
      return { snapshot };
    },
    onSuccess: (summary, { commentId }) => {
      updateCommentEverywhere(queryClient, postId, commentId, (comment) => ({
        ...comment,
        reactions: summary,
      }));
    },
    onError: (_error, _input, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      toast.error('Could not save the reaction');
    },
  });
}
