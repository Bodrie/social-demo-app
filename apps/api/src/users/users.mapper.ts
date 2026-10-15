import type { UserPrivate, UserPublic } from '@the-mesh/shared';
import { assetUrl } from '../common/assets.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Public profile fields plus counts and the two follow flags relative to the viewer. */
export function userPublicSelect(viewerId: string) {
  return {
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
    // viewer → this user
    followers: { where: { followerId: viewerId }, select: { followerId: true } },
    // this user → viewer
    following: { where: { followeeId: viewerId }, select: { followeeId: true } },
  } satisfies Prisma.UserSelect;
}

export function userPrivateSelect(viewerId: string) {
  return { ...userPublicSelect(viewerId), email: true, updatedAt: true } satisfies Prisma.UserSelect;
}

export type UserPublicRow = Prisma.UserGetPayload<{ select: ReturnType<typeof userPublicSelect> }>;
export type UserPrivateRow = Prisma.UserGetPayload<{ select: ReturnType<typeof userPrivateSelect> }>;

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
    followedByMe: row.followers.length > 0,
    followsMe: row.following.length > 0,
  };
}

export function toUserPrivate(row: UserPrivateRow, assetsBase: string): UserPrivate {
  return {
    ...toUserPublic(row, assetsBase),
    email: row.email,
    updatedAt: row.updatedAt.toISOString(),
  };
}
