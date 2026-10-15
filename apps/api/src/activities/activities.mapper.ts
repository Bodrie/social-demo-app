import { ACTIVITY_EXCERPT_LENGTH, type Activity } from '@the-mesh/shared';
import { assetUrl } from '../common/assets.js';
import type { Prisma } from '../generated/prisma/client.js';

const actorSelect = { select: { id: true, username: true, name: true, avatarKey: true } };

export const activitySelect = {
  id: true,
  type: true,
  createdAt: true,
  actor: actorSelect,
  post: { select: { id: true, content: true } },
  comment: { select: { id: true, content: true } },
  targetUser: actorSelect,
} satisfies Prisma.ActivitySelect;

export type ActivityRow = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;

export function excerpt(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > ACTIVITY_EXCERPT_LENGTH ? `${flat.slice(0, ACTIVITY_EXCERPT_LENGTH - 1)}…` : flat;
}

function toActor(row: ActivityRow['actor'], assetsBase: string): Activity['actor'] {
  return { id: row.id, username: row.username, name: row.name, avatarUrl: assetUrl(row.avatarKey, assetsBase) };
}

export function toActivity(row: ActivityRow, assetsBase: string): Activity {
  return {
    id: row.id,
    type: row.type,
    actor: toActor(row.actor, assetsBase),
    post: row.post ? { id: row.post.id, excerpt: excerpt(row.post.content) } : null,
    comment: row.comment ? { id: row.comment.id, excerpt: excerpt(row.comment.content) } : null,
    targetUser: row.targetUser ? toActor(row.targetUser, assetsBase) : null,
    createdAt: row.createdAt.toISOString(),
  };
}
