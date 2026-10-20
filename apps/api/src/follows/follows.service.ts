import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CursorQuery, Paginated, UserPublic } from '@beso/shared';
import { AssetsService } from '../assets/assets.service.js';
import { badRequest } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginateBy } from '../common/pagination.js';
import { UserFollowedEvent, UserUnfollowedEvent } from '../events/user.events.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserPublic, userPublicSelect } from '../users/users.mapper.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
    private readonly visibility: VisibilityService,
  ) {}

  /** Idempotent; only a new follow emits an event. */
  async follow(viewerId: string, targetId: string): Promise<void> {
    if (viewerId === targetId) throw badRequest('You cannot follow yourself');
    await this.users.assertExists(targetId);
    await this.visibility.assertNotBlocked(viewerId, targetId);
    const result = await this.prisma.follow.createMany({
      data: { followerId: viewerId, followeeId: targetId },
      skipDuplicates: true,
    });
    if (result.count === 1) {
      await this.events.emitAsync(
        UserFollowedEvent.EVENT,
        new UserFollowedEvent(viewerId, targetId),
      );
    }
  }

  async unfollow(viewerId: string, targetId: string): Promise<void> {
    await this.users.assertExists(targetId);
    const result = await this.prisma.follow.deleteMany({
      where: { followerId: viewerId, followeeId: targetId },
    });
    if (result.count === 1) {
      await this.events.emitAsync(
        UserUnfollowedEvent.EVENT,
        new UserUnfollowedEvent(viewerId, targetId),
      );
    }
  }

  /** Users following `userId`, most recent follow first. */
  async followers(
    viewerId: string,
    userId: string,
    query: CursorQuery,
  ): Promise<Paginated<UserPublic>> {
    await this.users.assertExists(userId);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.follow.findMany({
      where: {
        AND: [
          { followeeId: userId },
          cursor ? keysetAfter(cursor, (id) => ({ followerId: { lt: id } })) : {},
        ],
      },
      select: {
        followerId: true,
        createdAt: true,
        follower: { select: userPublicSelect(viewerId) },
      },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: query.limit + 1,
    });
    return paginateBy(
      rows,
      query.limit,
      (row) => ({ createdAt: row.createdAt, id: row.followerId }),
      (row) => toUserPublic(row.follower, this.assets.base),
    );
  }

  /** Users that `userId` follows, most recent follow first. */
  async following(
    viewerId: string,
    userId: string,
    query: CursorQuery,
  ): Promise<Paginated<UserPublic>> {
    await this.users.assertExists(userId);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.follow.findMany({
      where: {
        AND: [
          { followerId: userId },
          cursor ? keysetAfter(cursor, (id) => ({ followeeId: { lt: id } })) : {},
        ],
      },
      select: {
        followeeId: true,
        createdAt: true,
        followee: { select: userPublicSelect(viewerId) },
      },
      orderBy: [{ createdAt: 'desc' }, { followeeId: 'desc' }],
      take: query.limit + 1,
    });
    return paginateBy(
      rows,
      query.limit,
      (row) => ({ createdAt: row.createdAt, id: row.followeeId }),
      (row) => toUserPublic(row.followee, this.assets.base),
    );
  }
}
