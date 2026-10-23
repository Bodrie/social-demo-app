import {
  type CreatePostInput,
  type ExploreSort,
  type Post,
  type PostList,
  type RevisionList,
  type UpdatePostInput,
  postListSchema,
  postSchema,
  revisionListSchema,
} from '@beso/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchFeed = ({ cursor, signal }: PageOptions): Promise<PostList> =>
  api.get(`/posts${queryString({ cursor })}`, postListSchema, { signal });

export const fetchPost = (postId: string, signal?: AbortSignal): Promise<Post> =>
  api.get(`/posts/${postId}`, postSchema, { signal });

export const fetchExplore = (
  sort: ExploreSort,
  { cursor, signal }: PageOptions,
): Promise<PostList> =>
  api.get(`/explore/posts${queryString({ sort, cursor })}`, postListSchema, { signal });

export const fetchSearchPosts = (q: string, { cursor, signal }: PageOptions): Promise<PostList> =>
  api.get(`/search/posts${queryString({ q, cursor })}`, postListSchema, { signal });

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

export const bookmarkPost = (postId: string): Promise<void> => api.put(`/posts/${postId}/bookmark`);

export const unbookmarkPost = (postId: string): Promise<void> =>
  api.delete(`/posts/${postId}/bookmark`);

export const repostPost = (postId: string): Promise<void> => api.put(`/posts/${postId}/repost`);

export const unrepostPost = (postId: string): Promise<void> =>
  api.delete(`/posts/${postId}/repost`);

export const fetchBookmarks = ({ cursor, signal }: PageOptions): Promise<PostList> =>
  api.get(`/users/me/bookmarks${queryString({ cursor })}`, postListSchema, { signal });

export const updatePost = (postId: string, input: UpdatePostInput): Promise<Post> =>
  api.patch(`/posts/${postId}`, input, { schema: postSchema });

export const pinPost = (postId: string): Promise<void> => api.put(`/posts/${postId}/pin`);

export const unpinPost = (postId: string): Promise<void> => api.delete(`/posts/${postId}/pin`);

/** One vote, final (F3); the answer is the post with the results the voter may now see. */
export const votePoll = (postId: string, optionId: string): Promise<Post> =>
  api.put(`/posts/${postId}/poll/vote`, { optionId }, { schema: postSchema });

export const fetchPostRevisions = (
  postId: string,
  { cursor, signal }: PageOptions,
): Promise<RevisionList> =>
  api.get(`/posts/${postId}/revisions${queryString({ cursor })}`, revisionListSchema, { signal });
