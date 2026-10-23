import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ListUsersQuery,
  Paginated,
  UpdateProfileData,
  UpdateSettingsInput,
  UserPrivate,
  UserPublic,
  UserSummary,
} from '@beso/shared';
import { type PresetKind, findPreset } from '@beso/shared/pictures';
import { AssetsService } from '../assets/assets.service.js';
import { conflict, notFound, validationError } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { ProfileUpdatedEvent } from '../events/user.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { refreshRing } from './ring.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import {
  type UserPublicRow,
  toBlockedUserPublic,
  toUserPrivate,
  toUserPublic,
  toUserSettings,
  toUserSummary,
  userPrivateSelect,
  userPublicSelect,
  userSummarySelect,
} from './users.mapper.js';

export type UniqueFields = { email?: string; username?: string };

type ProfileField =
  | 'username'
  | 'name'
  | 'bio'
  | 'city'
  | 'website'
  | 'avatarKey'
  | 'coverKey'
  | 'avatarPreset'
  | 'coverPreset';

/** Escapes LIKE wildcards so `q=%` does not match everyone. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly uploads: UploadsService,
    private readonly assets: AssetsService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * A profile as the viewer may see it: whole, reduced to who it is across a block, or not
   * there at all while the member is suspended (ADR 0016).
   */
  private async present(viewerId: string, row: UserPublicRow): Promise<UserPublic> {
    if (row.id === viewerId) return toUserPublic(row, this.assets.base);
    if (row.suspendedAt) throw notFound('User not found');
    const relationship = await this.visibility.relationship(viewerId, row.id);
    return relationship.blocked || relationship.blockedMe
      ? toBlockedUserPublic(row, this.assets.base, relationship)
      : toUserPublic(row, this.assets.base, relationship);
  }

  async assertExists(id: string): Promise<void> {
    const count = await this.prisma.user.count({ where: { id } });
    if (count === 0) throw notFound('User not found');
  }

  /** The members among `usernames` (lower-case), for resolving @mentions; unknown names are simply absent. */
  async findByUsernames(usernames: readonly string[]): Promise<{ id: string; username: string }[]> {
    if (usernames.length === 0) return [];
    return this.prisma.user.findMany({
      where: { username: { in: [...usernames] } },
      select: { id: true, username: true },
    });
  }

  async summary(id: string): Promise<UserSummary | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: userSummarySelect });
    return row ? toUserSummary(row, this.assets.base) : null;
  }

  async getPublicById(viewerId: string, id: string): Promise<UserPublic> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: userPublicSelect(viewerId),
    });
    if (!row) throw notFound('User not found');
    return this.present(viewerId, row);
  }

  async getPublicByUsername(viewerId: string, username: string): Promise<UserPublic> {
    const row = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: userPublicSelect(viewerId),
    });
    if (!row) throw notFound('User not found');
    return this.present(viewerId, row);
  }

  async findPrivateById(id: string): Promise<UserPrivate | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: userPrivateSelect(id) });
    return row ? toUserPrivate(row, this.assets.base) : null;
  }

  async getPrivateById(id: string): Promise<UserPrivate> {
    const user = await this.findPrivateById(id);
    if (!user) throw notFound('User not found');
    return user;
  }

  /** Merges the given keys into the stored preferences; the answer carries every key with defaults. */
  async updateSettings(id: string, patch: UpdateSettingsInput): Promise<UserPrivate> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { settings: true },
    });
    if (!current) throw notFound('User not found');
    // Every key the patch carries replaces the stored one, the rest stay; the shared schema has
    // the last word, so a key added to it needs nothing here.
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    const next = toUserSettings({ ...toUserSettings(current.settings), ...changes });
    await this.prisma.user.update({ where: { id }, data: { settings: next } });
    // Both settings decide whether the avatar wears its Collector ring.
    if ('showRing' in changes || 'showAchievements' in changes) await refreshRing(this.prisma, id);
    return this.getPrivateById(id);
  }

  async updateProfile(id: string, patch: UpdateProfileData): Promise<UserPrivate> {
    const previous = await this.prisma.user.findUnique({
      where: { id },
      select: {
        username: true,
        name: true,
        bio: true,
        city: true,
        website: true,
        avatarKey: true,
        coverKey: true,
        avatarPreset: true,
        coverPreset: true,
      },
    });
    if (!previous) throw notFound('User not found');
    // A picture is an upload or a ready-made one, never both: picking one clears the other.
    const pictures = { ...patch };
    for (const [key, preset] of [
      ['avatarKey', 'avatarPreset'],
      ['coverKey', 'coverPreset'],
    ] as const) {
      if (typeof pictures[preset] === 'string') pictures[key] = null;
      else if (typeof pictures[key] === 'string') pictures[preset] = null;
    }

    // Only fields whose value actually changes are written and reported.
    const data: Prisma.UserUpdateInput = {};
    const changed: ProfileField[] = [];
    const changes: Array<[ProfileField, () => void]> = [
      ['username', () => (data.username = patch.username)],
      ['name', () => (data.name = patch.name)],
      ['bio', () => (data.bio = patch.bio)],
      ['city', () => (data.city = patch.city)],
      ['website', () => (data.website = patch.website)],
      ['avatarKey', () => (data.avatarKey = pictures.avatarKey)],
      ['coverKey', () => (data.coverKey = pictures.coverKey)],
      ['avatarPreset', () => (data.avatarPreset = pictures.avatarPreset)],
      ['coverPreset', () => (data.coverPreset = pictures.coverPreset)],
    ];
    for (const [field, apply] of changes) {
      if (pictures[field] !== undefined && pictures[field] !== previous[field]) {
        apply();
        changed.push(field);
      }
    }
    if (changed.length === 0) return this.getPrivateById(id);

    if (data.username !== undefined) {
      await this.assertAvailable({ username: patch.username }, id);
    }
    if (typeof data.avatarKey === 'string') {
      await this.uploads.assertOwned(data.avatarKey, {
        ownerId: id,
        kind: 'avatar',
        field: 'avatarKey',
      });
    }
    if (typeof data.coverKey === 'string') {
      await this.uploads.assertOwned(data.coverKey, {
        ownerId: id,
        kind: 'cover',
        field: 'coverKey',
      });
    }
    if (typeof data.avatarPreset === 'string') {
      await this.assertPreset(id, 'avatar', data.avatarPreset);
    }
    if (typeof data.coverPreset === 'string') {
      await this.assertPreset(id, 'cover', data.coverPreset);
    }

    const row = await this.prisma.user.update({
      where: { id },
      data,
      select: userPrivateSelect(id),
    });
    await this.events.emitAsync(ProfileUpdatedEvent.EVENT, new ProfileUpdatedEvent(id, changed));

    if (changed.includes('avatarKey')) await this.uploads.discard(previous.avatarKey);
    if (changed.includes('coverKey')) await this.uploads.discard(previous.coverKey);
    return toUserPrivate(row, this.assets.base);
  }

  /**
   * A ready-made picture must exist, and one a badge unlocks needs the badge (ADR 0021,
   * "Rewards"); earned is earned, so a picture once allowed stays allowed. `userId` null is a
   * registration, which offers the free pictures only.
   */
  async assertPreset(userId: string | null, kind: PresetKind, presetId: string): Promise<void> {
    const field = kind === 'avatar' ? 'avatarPreset' : 'coverPreset';
    const preset = findPreset(kind, presetId);
    if (!preset) throw validationError({ [field]: 'Unknown picture' });
    if (preset.unlockedBy === null) return;
    const held =
      userId !== null &&
      (await this.prisma.userAchievement.count({
        where: { userId, key: preset.unlockedBy },
      })) > 0;
    if (!held) throw validationError({ [field]: 'Earn the badge that unlocks it first' });
  }

  async list(viewerId: string, query: ListUsersQuery): Promise<Paginated<UserPublic>> {
    const cursor = decodeCursor(query.cursor);
    const search: Prisma.UserWhereInput = query.q
      ? {
          OR: [
            { username: { contains: escapeLike(query.q), mode: 'insensitive' } },
            { name: { contains: escapeLike(query.q), mode: 'insensitive' } },
          ],
        }
      : {};

    // Neither side of a block finds the other (ADR 0016).
    const rows = await this.prisma.user.findMany({
      where: {
        AND: [
          search,
          { id: { notIn: await this.visibility.blockedIds(viewerId) } },
          cursor ? keysetAfter(cursor, (userId) => ({ id: { lt: userId } })) : {},
        ],
      },
      select: userPublicSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => toUserPublic(row, this.assets.base));
  }

  /** Users the viewer neither follows nor is followed by, nor blocked or muted. */
  async suggestions(viewerId: string, limit: number): Promise<Paginated<UserPublic>> {
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: viewerId, notIn: await this.visibility.hiddenAuthorIds(viewerId) },
        followers: { none: { followerId: viewerId } },
        following: { none: { followeeId: viewerId } },
      },
      select: userPublicSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return { items: rows.map((row) => toUserPublic(row, this.assets.base)), nextCursor: null };
  }

  /** Throws 409 with per-field messages when the email or username is taken by another user. */
  async assertAvailable({ email, username }: UniqueFields, excludeUserId?: string): Promise<void> {
    const conditions: Prisma.UserWhereInput[] = [];
    if (email !== undefined) conditions.push({ email });
    if (username !== undefined) conditions.push({ username });
    if (conditions.length === 0) return;

    const clashes = await this.prisma.user.findMany({
      where: { OR: conditions, ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}) },
      select: { email: true, username: true },
    });
    if (clashes.length === 0) return;

    const fields: Record<string, string> = {};
    if (email !== undefined && clashes.some((row) => row.email === email)) {
      fields.email = 'An account with this email already exists';
    }
    if (username !== undefined && clashes.some((row) => row.username === username)) {
      fields.username = 'This username is taken';
    }
    throw conflict('Already in use', fields);
  }
}
