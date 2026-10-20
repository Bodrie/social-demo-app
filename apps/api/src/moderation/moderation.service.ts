import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CreateReportData,
  CursorQuery,
  Paginated,
  Report,
  UserSummary,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginateBy } from '../common/pagination.js';
import { UserUnfollowedEvent } from '../events/user.events.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';
import { UsersService } from '../users/users.service.js';

/** Blocks, mutes and reports from the member's side (ADR 0016); the admin queue is B5b. */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
  ) {}

  /**
   * Idempotent. The follows between the two go with the block, through the same event as an
   * unfollow so their activity and notification rows go too; the block itself is nobody's
   * business, so it raises no event of its own.
   */
  async block(viewerId: string, targetId: string): Promise<void> {
    if (viewerId === targetId) throw badRequest('You cannot block yourself');
    await this.users.assertExists(targetId);
    const follows = await this.prisma.$transaction(async (tx) => {
      await tx.block.createMany({
        data: { blockerId: viewerId, blockedId: targetId },
        skipDuplicates: true,
      });
      const rows = await tx.follow.findMany({
        where: {
          OR: [
            { followerId: viewerId, followeeId: targetId },
            { followerId: targetId, followeeId: viewerId },
          ],
        },
        select: { followerId: true, followeeId: true },
      });
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: viewerId, followeeId: targetId },
            { followerId: targetId, followeeId: viewerId },
          ],
        },
      });
      return rows;
    });
    for (const follow of follows) {
      // oxlint-disable-next-line no-await-in-loop -- at most two
      await this.events.emitAsync(
        UserUnfollowedEvent.EVENT,
        new UserUnfollowedEvent(follow.followerId, follow.followeeId),
      );
    }
    this.logger.log({ userId: viewerId, targetId }, 'Member blocked');
  }

  async unblock(viewerId: string, targetId: string): Promise<void> {
    await this.prisma.block.deleteMany({ where: { blockerId: viewerId, blockedId: targetId } });
  }

  async mute(viewerId: string, targetId: string): Promise<void> {
    if (viewerId === targetId) throw badRequest('You cannot mute yourself');
    await this.users.assertExists(targetId);
    await this.prisma.mute.createMany({
      data: { muterId: viewerId, mutedId: targetId },
      skipDuplicates: true,
    });
  }

  async unmute(viewerId: string, targetId: string): Promise<void> {
    await this.prisma.mute.deleteMany({ where: { muterId: viewerId, mutedId: targetId } });
  }

  /** Whom the viewer blocked, newest first. */
  async blocked(viewerId: string, query: CursorQuery): Promise<Paginated<UserSummary>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.block.findMany({
      where: {
        AND: [
          { blockerId: viewerId },
          cursor ? keysetAfter(cursor, (id) => ({ blockedId: { lt: id } })) : {},
        ],
      },
      select: { createdAt: true, blockedId: true, blocked: { select: userSummarySelect } },
      orderBy: [{ createdAt: 'desc' }, { blockedId: 'desc' }],
      take: query.limit + 1,
    });
    return paginateBy(
      rows,
      query.limit,
      (row) => ({ createdAt: row.createdAt, id: row.blockedId }),
      (row) => toUserSummary(row.blocked, this.assets.base),
    );
  }

  /** Whom the viewer muted, newest first. */
  async muted(viewerId: string, query: CursorQuery): Promise<Paginated<UserSummary>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.mute.findMany({
      where: {
        AND: [
          { muterId: viewerId },
          cursor ? keysetAfter(cursor, (id) => ({ mutedId: { lt: id } })) : {},
        ],
      },
      select: { createdAt: true, mutedId: true, muted: { select: userSummarySelect } },
      orderBy: [{ createdAt: 'desc' }, { mutedId: 'desc' }],
      take: query.limit + 1,
    });
    return paginateBy(
      rows,
      query.limit,
      (row) => ({ createdAt: row.createdAt, id: row.mutedId }),
      (row) => toUserSummary(row.muted, this.assets.base),
    );
  }

  /**
   * One open report per reporter and target; the target must exist now and must not be the
   * reporter's own. The row keeps only the target's id: whoever looks at the queue may find
   * it gone by then.
   */
  async report(reporterId: string, input: CreateReportData): Promise<Report> {
    const ownerId = await this.ownerOf(input.targetType, input.targetId);
    if (ownerId === reporterId) {
      throw badRequest(
        input.targetType === 'user'
          ? 'You cannot report yourself'
          : 'You cannot report your own content',
      );
    }
    const open = await this.prisma.report.count({
      where: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: 'open',
      },
    });
    if (open > 0) throw conflict('You already reported this');
    const row = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details || null,
      },
    });
    this.logger.log(
      { reportId: row.id, targetType: row.targetType, targetId: row.targetId },
      'Report filed',
    );
    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** The member a target belongs to; 404 when there is no such target. */
  private async ownerOf(type: CreateReportData['targetType'], id: string): Promise<string> {
    switch (type) {
      case 'post': {
        const post = await this.prisma.post.findUnique({
          where: { id },
          select: { authorId: true },
        });
        if (!post) throw notFound('Post not found');
        return post.authorId;
      }
      case 'comment': {
        const comment = await this.prisma.comment.findUnique({
          where: { id },
          select: { authorId: true },
        });
        if (!comment) throw notFound('Comment not found');
        return comment.authorId;
      }
      default: {
        await this.users.assertExists(id);
        return id;
      }
    }
  }
}
