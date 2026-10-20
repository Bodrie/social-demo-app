import {
  type Comment,
  REACTION_TYPES,
  type ReactionSummary,
  type ReactionType,
} from '@the-mesh/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { mentionsSelect } from '../posts/posts.mapper.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

/** A comment with its author and the viewer's own reaction; per-type counts come separately. */
export function commentSelect(viewerId: string) {
  return {
    id: true,
    postId: true,
    parentId: true,
    content: true,
    editedAt: true,
    reactionsCount: true,
    createdAt: true,
    updatedAt: true,
    author: { select: userSummarySelect },
    reactions: { where: { userId: viewerId }, select: { type: true } },
    mentions: mentionsSelect,
    _count: { select: { replies: true } },
  } satisfies Prisma.CommentSelect;
}

export type CommentRow = Prisma.CommentGetPayload<{ select: ReturnType<typeof commentSelect> }>;
export type ReactionCounts = Record<ReactionType, number>;

export function emptyCounts(): ReactionCounts {
  return { LIKE: 0, LOVE: 0, LAUGH: 0, WOW: 0, SAD: 0 };
}

export function isReactionType(value: string): value is ReactionType {
  return (REACTION_TYPES as readonly string[]).includes(value);
}

export function toReactionSummary(
  counts: ReactionCounts,
  total: number,
  mine: ReactionType | null,
): ReactionSummary {
  return { counts, total, mine };
}

export function toComment(row: CommentRow, counts: ReactionCounts, assetsBase: string): Comment {
  const mine = row.reactions[0]?.type ?? null;
  return {
    id: row.id,
    postId: row.postId,
    parentId: row.parentId,
    content: row.content,
    author: toUserSummary(row.author, assetsBase),
    editedAt: row.editedAt === null ? null : row.editedAt.toISOString(),
    reactions: toReactionSummary(counts, row.reactionsCount, mine),
    mentions: row.mentions.map((mention) => toUserSummary(mention.user, assetsBase)),
    replyCount: row._count.replies,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
