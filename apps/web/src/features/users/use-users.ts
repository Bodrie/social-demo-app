import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { fetchFollowers, fetchFollowing, fetchProfile } from '@/lib/api/users';
import { NO_CURSOR } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const profileQueryOptions = (username: string) =>
  queryOptions({
    queryKey: queryKeys.users.profile(username),
    queryFn: ({ signal }) => fetchProfile(username, signal),
  });

export function useProfile(username: string) {
  return useQuery(profileQueryOptions(username));
}

export const followersQueryOptions = (userId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.users.followers(userId),
    queryFn: ({ pageParam, signal }) => fetchFollowers(userId, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const followingQueryOptions = (userId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.users.following(userId),
    queryFn: ({ pageParam, signal }) => fetchFollowing(userId, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export function useFollowers(userId: string) {
  return useInfiniteQuery(followersQueryOptions(userId));
}

export function useFollowing(userId: string) {
  return useInfiniteQuery(followingQueryOptions(userId));
}
