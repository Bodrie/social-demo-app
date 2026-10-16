import {
  type CreatePostInput,
  type Post,
  type PostList,
  type RevisionList,
  type UpdatePostInput,
  postListSchema,
  postSchema,
  revisionListSchema,
} from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchFeed = ({ cursor, signal }: PageOptions): Promise<PostList> =>
  api.get(`/posts${queryString({ cursor })}`, postListSchema, { signal });

export const fetchUserPosts = (
  userId: string,
  { cursor, signal }: PageOptions,
): Promise<PostList> =>
  api.get(`/users/${userId}/posts${queryString({ cursor })}`, postListSchema, { signal });

export const createPost = (input: CreatePostInput): Promise<Post> =>
  api.post('/posts', input, { schema: postSchema });

export const deletePost = (postId: string): Promise<void> => api.delete(`/posts/${postId}`);

export const likePost = (postId: string): Promise<void> => api.put(`/posts/${postId}/like`);

export const unlikePost = (postId: string): Promise<void> => api.delete(`/posts/${postId}/like`);

export const updatePost = (postId: string, input: UpdatePostInput): Promise<Post> =>
  api.patch(`/posts/${postId}`, input, { schema: postSchema });

export const fetchPostRevisions = (postId: string, signal?: AbortSignal): Promise<RevisionList> =>
  api.get(`/posts/${postId}/revisions`, revisionListSchema, { signal });
