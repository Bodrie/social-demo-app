import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ListUsersQuery,
  Paginated,
  UpdateProfileData,
  UserPrivate,
  UserPublic,
} from '@the-mesh/shared';
import { decodeCursor, paginate } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { ProfileUpdatedEvent } from '../events/user.events.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { toUserPrivate, toUserPublic, userPrivateSelect, userPublicSelect } from './users.mapper.js';

export type UniqueFields = { email?: string; username?: string };

@Injectable()
export class UsersService {
  private readonly assetsBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly uploads: UploadsService,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  async getPublicById(id: string): Promise<UserPublic> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: userPublicSelect });
    if (!row) throw this.notFound();
    return toUserPublic(row, this.assetsBase);
  }

  async getPublicByUsername(username: string): Promise<UserPublic> {
    const row = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: userPublicSelect,
    });
    if (!row) throw this.notFound();
    return toUserPublic(row, this.assetsBase);
  }

  async getPrivateById(id: string): Promise<UserPrivate> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: userPrivateSelect });
    if (!row) throw this.notFound();
    return toUserPrivate(row, this.assetsBase);
  }

  async updateProfile(id: string, patch: UpdateProfileData): Promise<UserPrivate> {
    const data: Prisma.UserUpdateInput = {};
    if (patch.username !== undefined) data.username = patch.username;
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.bio !== undefined) data.bio = patch.bio;
    if (patch.city !== undefined) data.city = patch.city;
    if (patch.website !== undefined) data.website = patch.website;
    if (patch.avatarKey !== undefined) data.avatarKey = patch.avatarKey;
    if (patch.coverKey !== undefined) data.coverKey = patch.coverKey;

    if (data.username !== undefined || data.email !== undefined) {
      await this.assertAvailable({ email: patch.email, username: patch.username }, id);
    }
    if (patch.avatarKey) await this.uploads.assertExists(patch.avatarKey, 'avatarKey');
    if (patch.coverKey) await this.uploads.assertExists(patch.coverKey, 'coverKey');

    const replacesPicture = patch.avatarKey !== undefined || patch.coverKey !== undefined;
    const previous = replacesPicture
      ? await this.prisma.user.findUnique({ where: { id }, select: { avatarKey: true, coverKey: true } })
      : null;

    const row = await this.prisma.user.update({ where: { id }, data, select: userPrivateSelect });
    this.events.emit(ProfileUpdatedEvent.EVENT, new ProfileUpdatedEvent(id, Object.keys(data)));

    if (previous) {
      if (patch.avatarKey !== undefined && previous.avatarKey !== patch.avatarKey) {
        await this.uploads.discard(previous.avatarKey);
      }
      if (patch.coverKey !== undefined && previous.coverKey !== patch.coverKey) {
        await this.uploads.discard(previous.coverKey);
      }
    }
    return toUserPrivate(row, this.assetsBase);
  }

  async list(query: ListUsersQuery): Promise<Paginated<UserPublic>> {
    const cursorId = decodeCursor(query.cursor);
    const where: Prisma.UserWhereInput = query.q
      ? {
          OR: [
            { username: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const rows = await this.prisma.user.findMany({
      where,
      select: userPublicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    return paginate(rows, query.limit, (row) => toUserPublic(row, this.assetsBase));
  }

  /** Users the viewer neither follows nor is followed by. */
  async suggestions(viewerId: string, limit: number): Promise<UserPublic[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: viewerId },
        followers: { none: { followerId: viewerId } },
        following: { none: { followeeId: viewerId } },
      },
      select: userPublicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map((row) => toUserPublic(row, this.assetsBase));
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
    throw new ConflictException({ code: 'CONFLICT', message: 'Already in use', fields });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
  }
}
