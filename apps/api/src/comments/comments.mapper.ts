import type { Comment } from '@the-mesh/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

export const commentSelect = {
  id: true,
  postId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: userSummarySelect },
} satisfies Prisma.CommentSelect;

export type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

export function toComment(row: CommentRow, assetsBase: string): Comment {
  return {
    id: row.id,
    postId: row.postId,
    content: row.content,
    author: toUserSummary(row.author, assetsBase),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
