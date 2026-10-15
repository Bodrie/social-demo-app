import type { Comment } from '@the-mesh/shared';
import { assetUrl } from '../common/assets.js';
import type { Prisma } from '../generated/prisma/client.js';

export const commentSelect = {
  id: true,
  postId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, username: true, name: true, avatarKey: true } },
} satisfies Prisma.CommentSelect;

export type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

export function toComment(row: CommentRow, assetsBase: string): Comment {
  return {
    id: row.id,
    postId: row.postId,
    content: row.content,
    author: {
      id: row.author.id,
      username: row.author.username,
      name: row.author.name,
      avatarUrl: assetUrl(row.author.avatarKey, assetsBase),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
