import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { updateMe } from '@/features/auth/use-me';
import { updateUserEverywhere } from '@/features/users/user-cache';
import { isApiClientError } from '@/lib/api/client';
import {
  featureBadges,
  fetchAchievementStats,
  fetchMyAchievements,
  fetchUserAchievements,
} from '@/lib/api/achievements';
import { queryKeys } from '@/lib/query-keys';

export const myAchievementsQueryOptions = queryOptions({
  queryKey: queryKeys.achievements.mine,
  queryFn: ({ signal }) => fetchMyAchievements(signal),
});

/** The member's own badges and progress; a new badge's push invalidates it (`receiveNotification`). */
export function useMyAchievements() {
  return useQuery(myAchievementsQueryOptions);
}

export function useUserAchievements(userId: string) {
  return useQuery({
    queryKey: queryKeys.achievements.user(userId),
    queryFn: ({ signal }) => fetchUserAchievements(userId, signal),
  });
}

/** Counted by the server once an hour, so there is no point in asking more often. */
export function useAchievementStats() {
  return useQuery({
    queryKey: queryKeys.achievements.stats,
    queryFn: ({ signal }) => fetchAchievementStats(signal),
    staleTime: 60 * 60 * 1000,
  });
}

/** The badges under the member's name (ADR 0021, "Rewards"): `me` and the profile caches follow. */
export function useFeatureBadges() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: (keys: string[]) => featureBadges(keys),
    onSuccess: (_result, featuredBadges) => {
      updateMe(queryClient, (user) => ({ ...user, featuredBadges }));
      updateUserEverywhere(queryClient, me.id, (user) => ({ ...user, featuredBadges }));
    },
    onError: (error) =>
      toast.error(isApiClientError(error) ? error.message : 'Could not change your badges'),
  });
}
