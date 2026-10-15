import {
  type MeResponse,
  type UpdateProfileInput,
  type UserList,
  type UserPublic,
  meResponseSchema,
  userListSchema,
  userPublicSchema,
} from '@the-mesh/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchProfile = (username: string, signal?: AbortSignal): Promise<UserPublic> =>
  api.get(`/users/by-username/${encodeURIComponent(username)}`, userPublicSchema, { signal });

export const fetchFollowers = (userId: string, { cursor, signal }: PageOptions): Promise<UserList> =>
  api.get(`/users/${userId}/followers${queryString({ cursor })}`, userListSchema, { signal });

export const fetchFollowing = (userId: string, { cursor, signal }: PageOptions): Promise<UserList> =>
  api.get(`/users/${userId}/following${queryString({ cursor })}`, userListSchema, { signal });

export const fetchUsers = ({ q, cursor, signal }: PageOptions & { q?: string }): Promise<UserList> =>
  api.get(`/users${queryString({ q, cursor })}`, userListSchema, { signal });

export const fetchSuggestions = (limit: number, signal?: AbortSignal): Promise<UserList> =>
  api.get(`/users/suggestions${queryString({ limit })}`, userListSchema, { signal });

export const followUser = (userId: string): Promise<void> => api.put(`/users/${userId}/follow`);

export const unfollowUser = (userId: string): Promise<void> => api.delete(`/users/${userId}/follow`);

export const updateProfile = (input: UpdateProfileInput): Promise<MeResponse> =>
  api.patch('/users/me', input, { schema: meResponseSchema });
