import {
  type CreatePostInput,
  type Post,
  type PostList,
  postListSchema,
  postSchema,
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
