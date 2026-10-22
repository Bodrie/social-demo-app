import {
  type AchievementList,
  achievementListSchema,
  type AchievementStats,
  achievementStatsSchema,
  type MyAchievements,
  myAchievementsSchema,
} from '@beso/shared/achievements';
import { api } from './client';

/** The member's own badges and the count of every series, for the progress of the rest. */
export const fetchMyAchievements = (signal?: AbortSignal): Promise<MyAchievements> =>
  api.get('/users/me/achievements', myAchievementsSchema, { signal });

/** What a member earned; empty while they hide their badges or across a block. */
export const fetchUserAchievements = (
  userId: string,
  signal?: AbortSignal,
): Promise<AchievementList> =>
  api.get(`/users/${userId}/achievements`, achievementListSchema, { signal });

export const fetchAchievementStats = (signal?: AbortSignal): Promise<AchievementStats> =>
  api.get('/achievements/stats', achievementStatsSchema, { signal });
