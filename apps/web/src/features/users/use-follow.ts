import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserPublic } from '@the-mesh/shared';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { updateMe } from '@/features/auth/use-me';
import { followUser, unfollowUser } from '@/lib/api/users';
import { holdQueries, resumeQueries, runningToggles } from '@/lib/optimistic';
import { queryKeys } from '@/lib/query-keys';
import { updateUserEverywhere, userQueryKeysShowing } from './user-cache';

type ToggleFollowInput = { userId: string; following: boolean };
const FOLLOW_KEY = ['users', 'follow'] as const;

/** The user as I see them with my follow set to `following`; unchanged if it already is. */
function withFollow(user: UserPublic, following: boolean): UserPublic {
  if (user.followedByMe === following) return user;
  const followers = Math.max(0, user.counts.followers + (following ? 1 : -1));
  return { ...user, followedByMe: following, counts: { ...user.counts, followers } };
}

/**
 * Optimistic follow/unfollow: flags and counts flip at once. Only the two people involved are
 * touched (them and my own "following" count), so other follows in flight keep theirs.
 */
export function useToggleFollow() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();

  const adjustMyFollowing = (delta: number) => {
    const bump = <T extends { counts: UserPublic['counts'] }>(user: T): T => ({
      ...user,
      counts: { ...user.counts, following: Math.max(0, user.counts.following + delta) },
    });
    updateUserEverywhere(queryClient, me.id, bump);
    updateMe(queryClient, bump);
  };

  return useMutation({
    mutationKey: FOLLOW_KEY,
    mutationFn: ({ userId, following }: ToggleFollowInput) =>
      following ? unfollowUser(userId) : followUser(userId),
    onMutate: async ({ userId, following }) => {
      const interrupted = await holdQueries(
        queryClient,
        userQueryKeysShowing(queryClient, [userId, me.id]),
      );
      updateUserEverywhere(queryClient, userId, (user) => withFollow(user, !following));
      adjustMyFollowing(following ? -1 : 1);
      return { interrupted };
    },
    onError: (_error, { userId, following }) => {
      const showing = userQueryKeysShowing(queryClient, [userId, me.id]);
      updateUserEverywhere(queryClient, userId, (user) => withFollow(user, following));
      adjustMyFollowing(following ? 1 : -1);
      for (const queryKey of showing) void queryClient.invalidateQueries({ queryKey, exact: true });
      toast.error('Could not update the follow');
    },
    onSuccess: (_result, { userId, following }) => {
      // In case a list was refetched with the old state while the request was on its way.
      if (runningToggles(queryClient, FOLLOW_KEY, { userId }) === 1) {
        updateUserEverywhere(queryClient, userId, (user) => withFollow(user, !following));
      }
      // The feed is made of followed people; the two lists involved may be open elsewhere.
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.feed });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.followers(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.following(me.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
    },
    onSettled: (_result, _error, _input, context) =>
      resumeQueries(queryClient, context?.interrupted ?? []),
  });
}
