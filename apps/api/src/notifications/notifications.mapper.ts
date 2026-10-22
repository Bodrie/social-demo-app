import type { Notification } from '@beso/shared';
import { excerpt } from '../activities/activities.mapper.js';
import type { Prisma } from '../generated/prisma/client.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

export const notificationSelect = {
  id: true,
  type: true,
  achievementKey: true,
  readAt: true,
  createdAt: true,
  actor: { select: userSummarySelect },
  post: { select: { id: true, content: true } },
  comment: { select: { id: true, content: true } },
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

export function toNotification(row: NotificationRow, assetsBase: string): Notification {
  return {
    id: row.id,
    type: row.type,
    actor: row.actor ? toUserSummary(row.actor, assetsBase) : null,
    achievementKey: row.achievementKey,
    post: row.post ? { id: row.post.id, excerpt: excerpt(row.post.content) } : null,
    comment: row.comment ? { id: row.comment.id, excerpt: excerpt(row.comment.content) } : null,
    readAt: row.readAt === null ? null : row.readAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
