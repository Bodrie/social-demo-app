import { queryOptions, useQuery } from '@tanstack/react-query';
import {
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
