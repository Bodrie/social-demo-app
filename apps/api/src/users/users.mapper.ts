import type { UserPrivate, UserPublic, UserSummary } from '@the-mesh/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** The compact shape embedded in posts, comments, activities, messages and presence. */
export const userSummarySelect = {
  id: true,
  username: true,
  name: true,
  avatarKey: true,
} satisfies Prisma.UserSelect;

export type UserSummaryRow = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;

export function toUserSummary(row: UserSummaryRow, assetsBase: string): UserSummary {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarKey === null ? null : `${assetsBase}/${row.avatarKey}`,
  };
}

/** Public profile fields plus counts and the two follow flags relative to the viewer. */
export function userPublicSelect(viewerId: string) {
  return {
    ...userSummarySelect,
    bio: true,
    city: true,
    website: true,
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
  return {
    ...userPublicSelect(viewerId),
    email: true,
    updatedAt: true,
  } satisfies Prisma.UserSelect;
}

export type UserPublicRow = Prisma.UserGetPayload<{ select: ReturnType<typeof userPublicSelect> }>;
export type UserPrivateRow = Prisma.UserGetPayload<{
  select: ReturnType<typeof userPrivateSelect>;
}>;

export function toUserPublic(row: UserPublicRow, assetsBase: string): UserPublic {
  return {
    ...toUserSummary(row, assetsBase),
    bio: row.bio,
    city: row.city,
    website: row.website,
    coverUrl: row.coverKey === null ? null : `${assetsBase}/${row.coverKey}`,
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
