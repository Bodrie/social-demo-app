import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { Comment, CreateCommentInput } from '@the-mesh/shared';
import { toast } from 'sonner';
import { createComment, deleteComment, fetchComments } from '@/lib/api/comments';
import { NO_CURSOR, type Pages, filterItems, prependItem } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';
import { updatePostEverywhere } from '@/features/posts/post-cache';

type CommentPages = Pages<Comment>;

export const commentsQueryOptions = (postId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.comments.forPost(postId),
    queryFn: ({ pageParam, signal }) => fetchComments(postId, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export function useComments(postId: string) {
  return useInfiniteQuery(commentsQueryOptions(postId));
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(postId, input),
    onSuccess: (comment) => {
      queryClient.setQueryData<CommentPages>(
        queryKeys.comments.forPost(postId),
        (data) => data && prependItem(data, comment),
      );
      updatePostEverywhere(queryClient, postId, (post) => ({
        ...post,
        commentCount: post.commentCount + 1,
      }));
    },
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_result, commentId) => {
      queryClient.setQueryData<CommentPages>(
        queryKeys.comments.forPost(postId),
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
