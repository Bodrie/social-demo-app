import type { Post } from '@the-mesh/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

/** Everything a feed item needs, in one query: author, counts and whether the viewer liked it. */
export function postSelect(viewerId: string) {
  return {
    id: true,
    content: true,
    imageKey: true,
    editedAt: true,
    createdAt: true,
    updatedAt: true,
    author: { select: userSummarySelect },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  } satisfies Prisma.PostSelect;
}

export type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

export function toPost(row: PostRow, assetsBase: string): Post {
  return {
    id: row.id,
    content: row.content,
    imageUrl: row.imageKey === null ? null : `${assetsBase}/${row.imageKey}`,
    author: toUserSummary(row.author, assetsBase),
    likeCount: row._count.likes,
    commentCount: row._count.comments,
    likedByMe: row.likes.length > 0,
    editedAt: row.editedAt === null ? null : row.editedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
