import {
  type Comment,
  type CommentList,
  type CreateCommentInput,
  commentListSchema,
  commentSchema,
} from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchComments = (postId: string, { cursor, signal }: PageOptions): Promise<CommentList> =>
  api.get(`/posts/${postId}/comments${queryString({ cursor })}`, commentListSchema, { signal });

export const createComment = (postId: string, input: CreateCommentInput): Promise<Comment> =>
  api.post(`/posts/${postId}/comments`, input, { schema: commentSchema });

export const deleteComment = (commentId: string): Promise<void> => api.delete(`/comments/${commentId}`);
