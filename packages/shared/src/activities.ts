import { z } from 'zod';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { userSummarySchema } from './users.js';

/** Mirrors the database enum. */
export const ACTIVITY_TYPES = [
  'POST_CREATED',
  'COMMENT_CREATED',
  'POST_LIKED',
  'USER_FOLLOWED',
  'PROFILE_UPDATED',
  'USER_REGISTERED',
  /** `post` is the original, `targetUser` its author (ADR 0017). */
  'POST_REPOSTED',
  /** `post` is the quote, `targetUser` the author of what it quotes. */
  'POST_QUOTED',
] as const;
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);
export type ActivityType = z.infer<typeof activityTypeSchema>;

export const ACTIVITY_EXCERPT_LENGTH = 80;

/** A post or comment named by its id and the start of its text (activities, notifications). */
export const excerptSchema = z.object({ id: z.uuid(), excerpt: z.string() });
export type Excerpt = z.infer<typeof excerptSchema>;

/** Something a followed user did. Subjects are present depending on `type`. */
export const activitySchema = z.object({
  id: z.uuid(),
  type: activityTypeSchema,
  actor: userSummarySchema,
  post: excerptSchema.nullable(),
  comment: excerptSchema.nullable(),
  targetUser: userSummarySchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type Activity = z.infer<typeof activitySchema>;

export const activityListSchema = paginatedSchema(activitySchema);
export type ActivityList = z.infer<typeof activityListSchema>;

export const activitiesQuerySchema = cursorQuerySchema;
