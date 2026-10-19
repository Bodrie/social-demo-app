import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ListUsersQuery,
  Paginated,
  UpdateProfileData,
  UserPrivate,
  UserPublic,
  UserSummary,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { conflict, notFound } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { ProfileUpdatedEvent } from '../events/user.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import {
  toUserPrivate,
  toUserPublic,
  toUserSummary,
  userPrivateSelect,
  userPublicSelect,
  userSummarySelect,
} from './users.mapper.js';

export type UniqueFields = { email?: string; username?: string };

type ProfileField = 'username' | 'name' | 'bio' | 'city' | 'website' | 'avatarKey' | 'coverKey';

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
  ) {}

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
    return toUserPublic(row, this.assets.base);
  }

  async getPublicByUsername(viewerId: string, username: string): Promise<UserPublic> {
    const row = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: userPublicSelect(viewerId),
    });
    if (!row) throw notFound('User not found');
    return toUserPublic(row, this.assets.base);
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
      },
    });
    if (!previous) throw notFound('User not found');

    // Only fields whose value actually changes are written and reported.
    const data: Prisma.UserUpdateInput = {};
    const changed: ProfileField[] = [];
    const changes: Array<[ProfileField, () => void]> = [
      ['username', () => (data.username = patch.username)],
      ['name', () => (data.name = patch.name)],
      ['bio', () => (data.bio = patch.bio)],
      ['city', () => (data.city = patch.city)],
      ['website', () => (data.website = patch.website)],
      ['avatarKey', () => (data.avatarKey = patch.avatarKey)],
      ['coverKey', () => (data.coverKey = patch.coverKey)],
    ];
    for (const [field, apply] of changes) {
      if (patch[field] !== undefined && patch[field] !== previous[field]) {
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

    const rows = await this.prisma.user.findMany({
      where: {
        AND: [search, cursor ? keysetAfter(cursor, (userId) => ({ id: { lt: userId } })) : {}],
      },
      select: userPublicSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => toUserPublic(row, this.assets.base));
  }

  /** Users the viewer neither follows nor is followed by. */
  async suggestions(viewerId: string, limit: number): Promise<Paginated<UserPublic>> {
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: viewerId },
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
