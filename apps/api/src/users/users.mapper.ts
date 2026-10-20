import {
  type UserPrivate,
  type UserPublic,
  type UserSettings,
  type UserSummary,
  userSettingsSchema,
} from '@the-mesh/shared';
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
    emailVerifiedAt: true,
    settings: true,
    updatedAt: true,
  } satisfies Prisma.UserSelect;
}

export type UserPublicRow = Prisma.UserGetPayload<{ select: ReturnType<typeof userPublicSelect> }>;
export type UserPrivateRow = Prisma.UserGetPayload<{
  select: ReturnType<typeof userPrivateSelect>;
}>;

/** The block and mute flags of a profile relative to the viewer (ADR 0016). */
export type Relationship = { blocked: boolean; blockedMe: boolean; muted: boolean };
const NO_RELATIONSHIP: Relationship = { blocked: false, blockedMe: false, muted: false };

export function toUserPublic(
  row: UserPublicRow,
  assetsBase: string,
  relationship: Relationship = NO_RELATIONSHIP,
): UserPublic {
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
    ...relationship,
  };
}

/** What either side of a block gets of the other: who it is and the flags, nothing more. */
export function toBlockedUserPublic(
  row: UserPublicRow,
  assetsBase: string,
  relationship: Relationship,
): UserPublic {
  return {
    ...toUserSummary(row, assetsBase),
    bio: null,
    city: null,
    website: null,
    coverUrl: null,
    createdAt: row.createdAt.toISOString(),
    counts: { posts: 0, followers: 0, following: 0 },
    followedByMe: false,
    followsMe: false,
    ...relationship,
  };
}

/** The stored JSON with defaults applied; anything unreadable falls back to the defaults. */
export function toUserSettings(stored: unknown): UserSettings {
  const parsed = userSettingsSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : userSettingsSchema.parse({});
}

export function toUserPrivate(row: UserPrivateRow, assetsBase: string): UserPrivate {
  return {
    ...toUserPublic(row, assetsBase),
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
    settings: toUserSettings(row.settings),
    updatedAt: row.updatedAt.toISOString(),
  };
}
