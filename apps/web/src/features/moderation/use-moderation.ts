import {
  type QueryClient,
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { CreateReportInput, UserPublic } from '@beso/shared';
import { toast } from 'sonner';
import { updateUserEverywhere } from '@/features/users/user-cache';
import { isApiClientError } from '@/lib/api/client';
import {
  blockUser,
  createReport,
  fetchBlocked,
  fetchMuted,
  muteUser,
  unblockUser,
  unmuteUser,
} from '@/lib/api/moderation';
import { NO_CURSOR } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const blockedQueryOptions = infiniteQueryOptions({
  queryKey: queryKeys.moderation.blocked,
  queryFn: ({ pageParam, signal }) => fetchBlocked({ cursor: pageParam, signal }),
  initialPageParam: NO_CURSOR,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

export const mutedQueryOptions = infiniteQueryOptions({
  queryKey: queryKeys.moderation.muted,
  queryFn: ({ pageParam, signal }) => fetchMuted({ cursor: pageParam, signal }),
  initialPageParam: NO_CURSOR,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

export function useBlockedMembers() {
  return useInfiniteQuery(blockedQueryOptions);
}

export function useMutedMembers() {
  return useInfiniteQuery(mutedQueryOptions);
}

/**
 * A block changes what every list may show (ADR 0016): the profile flips to its reduced
 * shape at once, everything else is refetched rather than patched.
 */
function afterBlockChange(queryClient: QueryClient): void {
  for (const queryKey of [
    queryKeys.posts.lists,
    queryKeys.comments.all,
    queryKeys.activities.all,
    queryKeys.notifications.all,
    queryKeys.conversations.all,
    queryKeys.users.lists,
    queryKeys.users.suggestions,
    queryKeys.moderation.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

const reduced = (user: UserPublic): UserPublic => ({
  ...user,
  bio: null,
  city: null,
  website: null,
  coverUrl: null,
  counts: { posts: 0, followers: 0, following: 0 },
  followedByMe: false,
  followsMe: false,
  blocked: true,
});

export function useBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: UserPublic) => blockUser(user.id),
    onSuccess: (_result, user) => {
      updateUserEverywhere(queryClient, user.id, reduced);
      afterBlockChange(queryClient);
      toast.success(`Blocked @${user.username}`);
    },
    onError: () => toast.error('Could not block this member'),
  });
}

export function useUnblock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: { id: string; username: string }) => unblockUser(user.id),
    onSuccess: (_result, user) => {
      // The whole profile comes back from the server; the flag flips now so nothing waits.
      updateUserEverywhere(queryClient, user.id, (cached) => ({ ...cached, blocked: false }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.profiles });
      afterBlockChange(queryClient);
      toast.success(`Unblocked @${user.username}`);
    },
    onError: () => toast.error('Could not unblock this member'),
  });
}

export function useMute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: UserPublic) => muteUser(user.id),
    onSuccess: (_result, user) => {
      updateUserEverywhere(queryClient, user.id, (cached) => ({ ...cached, muted: true }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.lists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.muted });
      toast.success(`Muted @${user.username}`);
    },
    onError: () => toast.error('Could not mute this member'),
  });
}

export function useUnmute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: { id: string; username: string }) => unmuteUser(user.id),
    onSuccess: (_result, user) => {
      updateUserEverywhere(queryClient, user.id, (cached) => ({ ...cached, muted: false }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.lists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.moderation.muted });
      toast.success(`Unmuted @${user.username}`);
    },
    onError: () => toast.error('Could not unmute this member'),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => createReport(input),
    onSuccess: () => toast.success('Thank you. We will look into it.'),
    onError: (error) => {
      toast.error(
        isApiClientError(error) && error.status === 409
          ? 'You already reported this'
          : 'Could not send the report',
      );
    },
  });
}
