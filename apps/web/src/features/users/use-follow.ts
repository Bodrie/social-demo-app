import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { updateMe } from '@/features/auth/use-me';
import { followUser, unfollowUser } from '@/lib/api/users';
import { queryKeys } from '@/lib/query-keys';
import { restoreQueries, snapshotQueries } from '@/lib/query-snapshot';
import { updateUserEverywhere } from './user-cache';

type ToggleFollowInput = { userId: string; following: boolean };

/** Optimistic follow/unfollow: flags and counts flip immediately, roll back on failure. */
export function useToggleFollow() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: ({ userId, following }: ToggleFollowInput) =>
      following ? unfollowUser(userId) : followUser(userId),
    onMutate: async ({ userId, following }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.all });
      const snapshot = snapshotQueries(
        queryClient,
        { queryKey: queryKeys.users.all },
        { queryKey: queryKeys.me },
      );
      const delta = following ? -1 : 1;
      updateUserEverywhere(queryClient, userId, (user) => ({
        ...user,
        followedByMe: !following,
        counts: { ...user.counts, followers: Math.max(0, user.counts.followers + delta) },
      }));
      updateUserEverywhere(queryClient, me.id, (user) => ({
        ...user,
        counts: { ...user.counts, following: Math.max(0, user.counts.following + delta) },
      }));
      updateMe(queryClient, (user) => ({
        ...user,
        counts: { ...user.counts, following: Math.max(0, user.counts.following + delta) },
      }));
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      toast.error('Could not update the follow');
    },
    onSuccess: (_result, { userId }) => {
      // The feed is made of followed people; the two lists involved may be open elsewhere.
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feed });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.followers(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.following(me.id) });
    },
  });
}
