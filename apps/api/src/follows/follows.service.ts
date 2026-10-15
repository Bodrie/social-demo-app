import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CursorQuery, Paginated, UserPublic } from '@the-mesh/shared';
import { decodeCursor, paginateBy } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { UserFollowedEvent, UserUnfollowedEvent } from '../events/user.events.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserPublic, userPublicSelect } from '../users/users.mapper.js';

@Injectable()
export class FollowsService {
  private readonly assetsBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  /** Idempotent; only a new follow emits an event. */
  async follow(viewerId: string, targetId: string): Promise<void> {
    if (viewerId === targetId) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'You cannot follow yourself' });
    }
    await this.assertUserExists(targetId);
    const result = await this.prisma.follow.createMany({
      data: { followerId: viewerId, followeeId: targetId },
      skipDuplicates: true,
    });
    if (result.count === 1) {
      await this.events.emitAsync(UserFollowedEvent.EVENT, new UserFollowedEvent(viewerId, targetId));
    }
  }

  async unfollow(viewerId: string, targetId: string): Promise<void> {
    await this.assertUserExists(targetId);
    const result = await this.prisma.follow.deleteMany({
      where: { followerId: viewerId, followeeId: targetId },
    });
    if (result.count === 1) {
      await this.events.emitAsync(UserUnfollowedEvent.EVENT, new UserUnfollowedEvent(viewerId, targetId));
    }
  }

  /** Users following `userId`, most recent follow first. */
  async followers(viewerId: string, userId: string, query: CursorQuery): Promise<Paginated<UserPublic>> {
    await this.assertUserExists(userId);
    const cursorId = decodeCursor(query.cursor);
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: userId },
      select: { followerId: true, follower: { select: userPublicSelect(viewerId) } },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: query.limit + 1,
      ...(cursorId
        ? { cursor: { followerId_followeeId: { followerId: cursorId, followeeId: userId } }, skip: 1 }
        : {}),
    });
    return paginateBy(
      rows,
      query.limit,
      (row) => row.followerId,
      (row) => toUserPublic(row.follower, this.assetsBase),
    );
  }

  /** Users that `userId` follows, most recent follow first. */
  async following(viewerId: string, userId: string, query: CursorQuery): Promise<Paginated<UserPublic>> {
    await this.assertUserExists(userId);
    const cursorId = decodeCursor(query.cursor);
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followeeId: true, followee: { select: userPublicSelect(viewerId) } },
      orderBy: [{ createdAt: 'desc' }, { followeeId: 'desc' }],
      take: query.limit + 1,
      ...(cursorId
        ? { cursor: { followerId_followeeId: { followerId: userId, followeeId: cursorId } }, skip: 1 }
        : {}),
    });
    return paginateBy(
      rows,
      query.limit,
      (row) => row.followeeId,
      (row) => toUserPublic(row.followee, this.assetsBase),
    );
  }

  private async assertUserExists(userId: string): Promise<void> {
    const count = await this.prisma.user.count({ where: { id: userId } });
    if (count === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
  }
}
