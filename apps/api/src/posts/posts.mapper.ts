import type { Post } from '@the-mesh/shared';
import { assetUrl } from '../common/assets.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Everything a feed item needs, in one query: author, counts and whether the viewer liked it. */
export function postSelect(viewerId: string) {
  return {
    id: true,
    content: true,
    imageKey: true,
    createdAt: true,
    updatedAt: true,
    author: { select: { id: true, username: true, name: true, avatarKey: true } },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  } satisfies Prisma.PostSelect;
}

export type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

export function toPost(row: PostRow, assetsBase: string): Post {
  return {
    id: row.id,
    content: row.content,
    imageUrl: assetUrl(row.imageKey, assetsBase),
    author: {
      id: row.author.id,
      username: row.author.username,
      name: row.author.name,
      avatarUrl: assetUrl(row.author.avatarKey, assetsBase),
    },
    likeCount: row._count.likes,
    commentCount: row._count.comments,
    likedByMe: row.likes.length > 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
