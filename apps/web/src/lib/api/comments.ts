import {
  type Comment,
  type CommentList,
  type CommentSort,
  type CreateCommentInput,
  type ReactionSummary,
  type ReactionType,
  type RevisionList,
  type UpdateCommentInput,
  commentListSchema,
  commentSchema,
  reactionSummarySchema,
  revisionListSchema,
} from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchComments = (
  postId: string,
  { cursor, sort, signal }: PageOptions & { sort: CommentSort },
): Promise<CommentList> =>
  api.get(`/posts/${postId}/comments${queryString({ cursor, sort })}`, commentListSchema, {
    signal,
  });

export const fetchComment = (commentId: string, signal?: AbortSignal): Promise<Comment> =>
  api.get(`/comments/${commentId}`, commentSchema, { signal });

export const createComment = (postId: string, input: CreateCommentInput): Promise<Comment> =>
  api.post(`/posts/${postId}/comments`, input, { schema: commentSchema });

export const updateComment = (commentId: string, input: UpdateCommentInput): Promise<Comment> =>
  api.patch(`/comments/${commentId}`, input, { schema: commentSchema });

export const deleteComment = (commentId: string): Promise<void> =>
  api.delete(`/comments/${commentId}`);

export const fetchCommentRevisions = (
  commentId: string,
  { cursor, signal }: PageOptions,
): Promise<RevisionList> =>
  api.get(`/comments/${commentId}/revisions${queryString({ cursor })}`, revisionListSchema, {
    signal,
  });

export const setReaction = (commentId: string, type: ReactionType): Promise<ReactionSummary> =>
  api.put(`/comments/${commentId}/reaction`, { type }, { schema: reactionSummarySchema });

export const clearReaction = (commentId: string): Promise<ReactionSummary> =>
  api.delete(`/comments/${commentId}/reaction`, { schema: reactionSummarySchema });
