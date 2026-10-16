import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import {
  fetchFollowers,
  fetchFollowing,
  fetchProfile,
  fetchSuggestions,
  fetchUsers,
} from '@/lib/api/users';
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

/** Everyone, or a name/username search; the key includes the query so each search is cached. */
export const usersQueryOptions = (q: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.users.search(q),
    queryFn: ({ pageParam, signal }) =>
      fetchUsers({ q: q || undefined, cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // While a new search loads, the previous results stay on screen instead of a skeleton.
    placeholderData: keepPreviousData,
  });

export function useUsers(q: string) {
  return useInfiniteQuery(usersQueryOptions(q));
}

export const suggestionsQueryOptions = (limit: number) =>
  queryOptions({
    queryKey: [...queryKeys.users.suggestions, limit] as const,
    queryFn: ({ signal }) => fetchSuggestions(limit, signal),
    select: (data) => data.items,
  });

export function useSuggestions(limit = 5) {
  return useQuery(suggestionsQueryOptions(limit));
}
