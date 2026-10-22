import { ACTIVITY_EXCERPT_LENGTH, type Activity } from '@beso/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

export const activitySelect = {
  id: true,
  type: true,
  createdAt: true,
  actor: { select: userSummarySelect },
  // `authorId` decides who may see the activity (ActivitiesListener); it is not answered.
  post: { select: { id: true, content: true, authorId: true } },
  comment: { select: { id: true, content: true } },
  targetUser: { select: userSummarySelect },
} satisfies Prisma.ActivitySelect;

export type ActivityRow = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;

export function excerpt(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > ACTIVITY_EXCERPT_LENGTH
    ? `${flat.slice(0, ACTIVITY_EXCERPT_LENGTH - 1)}…`
    : flat;
}

export function toActivity(row: ActivityRow, assetsBase: string): Activity {
  return {
    id: row.id,
    type: row.type,
    actor: toUserSummary(row.actor, assetsBase),
    post: row.post ? { id: row.post.id, excerpt: excerpt(row.post.content) } : null,
    comment: row.comment ? { id: row.comment.id, excerpt: excerpt(row.comment.content) } : null,
    targetUser: row.targetUser ? toUserSummary(row.targetUser, assetsBase) : null,
    createdAt: row.createdAt.toISOString(),
  };
}
