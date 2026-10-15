import type { UserPrivate, UserPublic } from '@the-mesh/shared';
import { assetUrl } from '../common/assets.js';
import type { Prisma } from '../generated/prisma/client.js';

export const userPublicSelect = {
  id: true,
  username: true,
  name: true,
  bio: true,
  city: true,
  website: true,
  avatarKey: true,
  coverKey: true,
  createdAt: true,
  _count: { select: { posts: true, followers: true, following: true } },
} satisfies Prisma.UserSelect;

export const userPrivateSelect = {
  ...userPublicSelect,
  email: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserPublicRow = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;
export type UserPrivateRow = Prisma.UserGetPayload<{ select: typeof userPrivateSelect }>;

export function toUserPublic(row: UserPublicRow, assetsBase: string): UserPublic {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    bio: row.bio,
    city: row.city,
    website: row.website,
    avatarUrl: assetUrl(row.avatarKey, assetsBase),
    coverUrl: assetUrl(row.coverKey, assetsBase),
    createdAt: row.createdAt.toISOString(),
    counts: {
      posts: row._count.posts,
      followers: row._count.followers,
      following: row._count.following,
    },
  };
}

export function toUserPrivate(row: UserPrivateRow, assetsBase: string): UserPrivate {
  return {
    ...toUserPublic(row, assetsBase),
    email: row.email,
    updatedAt: row.updatedAt.toISOString(),
  };
}
