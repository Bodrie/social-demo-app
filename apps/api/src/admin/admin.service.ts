import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AdminReport,
  AdminReportTarget,
  AdminReportsQuery,
  Paginated,
  UserSummary,
} from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { RefreshTokensService } from '../auth/refresh-tokens.service.js';
import { CommentsService } from '../comments/comments.service.js';
import { badRequest, notFound } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import type { Env } from '../config/env.js';
import { excerpt } from '../activities/activities.mapper.js';
import type { AdminActionType, Prisma, ReportStatus } from '../generated/prisma/client.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserSummary, userSummarySelect } from '../users/users.mapper.js';

const reportSelect = {
  id: true,
  targetType: true,
  targetId: true,
  reason: true,
  details: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  reporter: { select: userSummarySelect },
} satisfies Prisma.ReportSelect;
type ReportRow = Prisma.ReportGetPayload<{ select: typeof reportSelect }>;

type MemberRow = Prisma.UserGetPayload<{
  select: typeof userSummarySelect & { suspendedAt: true };
}>;

/** The admin side of ADR 0016: who is an admin, the reports queue, and what an admin may do. */
@Injectable()
export class AdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminService.name);
  private readonly adminEmails: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly assets: AssetsService,
    config: ConfigService<Env, true>,
  ) {
    this.adminEmails = config.get('ADMIN_EMAILS', { infer: true });
  }

  /**
   * `ADMIN_EMAILS` is authoritative when set: the listed accounts become admins, every other
   * admin becomes a member. Unset, the roles stay as they are (the seed's, for one).
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.adminEmails.length === 0) return;
    const [promoted, demoted] = await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { email: { in: this.adminEmails, mode: 'insensitive' }, role: 'member' },
        data: { role: 'admin' },
      }),
      this.prisma.user.updateMany({
        where: { email: { notIn: this.adminEmails, mode: 'insensitive' }, role: 'admin' },
        data: { role: 'member' },
      }),
    ]);
    this.logger.log(
      { admins: this.adminEmails.length, promoted: promoted.count, demoted: demoted.count },
      'Admin roles synchronised with ADMIN_EMAILS',
    );
  }

  /** The queue, one status at a time, newest report first, each with what it points at. */
  async reports(query: AdminReportsQuery): Promise<Paginated<AdminReport>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.report.findMany({
      where: {
        AND: [
          { status: query.status },
          cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {},
        ],
      },
      select: reportSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const targets = await this.targetsOf(rows);
    return paginate(rows, query.limit, (row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt === null ? null : row.resolvedAt.toISOString(),
      reporter: toUserSummary(row.reporter, this.assets.base),
      target: targets.get(row.id) ?? {
        type: row.targetType,
        id: row.targetId,
        gone: true,
        excerpt: null,
        postId: null,
        member: null,
      },
    }));
  }

  async resolve(adminId: string, reportId: string): Promise<AdminReport> {
    return this.settle(adminId, reportId, 'resolved', 'report_resolved');
  }

  async dismiss(adminId: string, reportId: string): Promise<AdminReport> {
    return this.settle(adminId, reportId, 'dismissed', 'report_dismissed');
  }

  /** The services do the work (events, files, counters); the queue only adds the audit row. */
  async deletePost(adminId: string, postId: string): Promise<void> {
    await this.posts.delete(adminId, postId, { asAdmin: true });
    await this.audit(adminId, 'post_deleted', postId);
  }

  async deleteComment(adminId: string, commentId: string): Promise<void> {
    await this.comments.delete(adminId, commentId, { asAdmin: true });
    await this.audit(adminId, 'comment_deleted', commentId);
  }

  /**
   * Ends every session of the member (sockets included, through `revokeAll`) and keeps them
   * out at sign-in; their content stays in the database but leaves every list (ADR 0016).
   * Admins cannot be suspended, nor oneself: demote first.
   */
  async suspend(adminId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, suspendedAt: true },
    });
    if (!user) throw notFound('User not found');
    if (userId === adminId) throw badRequest('You cannot suspend yourself');
    if (user.role === 'admin') throw badRequest('Admins cannot be suspended; demote them first');
    if (user.suspendedAt === null) {
      await this.prisma.user.update({ where: { id: userId }, data: { suspendedAt: new Date() } });
    }
    await this.refreshTokens.revokeAll(userId);
    await this.audit(adminId, 'user_suspended', userId);
    this.logger.log({ adminId, userId }, 'Member suspended');
  }

  async unsuspend(adminId: string, userId: string): Promise<void> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { suspendedAt: null },
    });
    if (result.count === 0) throw notFound('User not found');
    await this.audit(adminId, 'user_unsuspended', userId);
    this.logger.log({ adminId, userId }, 'Member unsuspended');
  }

  private async settle(
    adminId: string,
    reportId: string,
    status: ReportStatus,
    action: AdminActionType,
  ): Promise<AdminReport> {
    const existing = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    if (!existing) throw notFound('Report not found');
    const row = await this.prisma.report.update({
      where: { id: reportId },
      data: { status, resolvedById: adminId, resolvedAt: new Date() },
      select: reportSelect,
    });
    await this.audit(adminId, action, reportId);
    const targets = await this.targetsOf([row]);
    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt === null ? null : row.resolvedAt.toISOString(),
      reporter: toUserSummary(row.reporter, this.assets.base),
      target: targets.get(row.id) ?? {
        type: row.targetType,
        id: row.targetId,
        gone: true,
        excerpt: null,
        postId: null,
        member: null,
      },
    };
  }

  private async audit(adminId: string, action: AdminActionType, targetId: string): Promise<void> {
    await this.prisma.adminAction.create({ data: { adminId, action, targetId } });
  }

  /** What each report points at, looked up per page: posts, comments and members by id. */
  private async targetsOf(rows: ReportRow[]): Promise<Map<string, AdminReportTarget>> {
    const ids = (type: ReportRow['targetType']) =>
      rows.filter((row) => row.targetType === type).map((row) => row.targetId);
    const memberSelect = { ...userSummarySelect, suspendedAt: true } as const;
    const [posts, comments, users] = await Promise.all([
      this.prisma.post.findMany({
        where: { id: { in: ids('post') } },
        select: { id: true, content: true, author: { select: memberSelect } },
      }),
      this.prisma.comment.findMany({
        where: { id: { in: ids('comment') } },
        select: { id: true, content: true, postId: true, author: { select: memberSelect } },
      }),
      this.prisma.user.findMany({ where: { id: { in: ids('user') } }, select: memberSelect }),
    ]);
    const member = (row: MemberRow): AdminReportTarget['member'] => ({
      ...(toUserSummary(row, this.assets.base) satisfies UserSummary),
      suspended: row.suspendedAt !== null,
    });
    const targets = new Map<string, AdminReportTarget>();
    for (const row of rows) {
      const base = { type: row.targetType, id: row.targetId, gone: false };
      if (row.targetType === 'post') {
        const post = posts.find((item) => item.id === row.targetId);
        if (post) {
          targets.set(row.id, {
            ...base,
            excerpt: excerpt(post.content),
            postId: post.id,
            member: member(post.author),
          });
        }
      } else if (row.targetType === 'comment') {
        const comment = comments.find((item) => item.id === row.targetId);
        if (comment) {
          targets.set(row.id, {
            ...base,
            excerpt: excerpt(comment.content),
            postId: comment.postId,
            member: member(comment.author),
          });
        }
      } else {
        const user = users.find((item) => item.id === row.targetId);
        if (user)
          targets.set(row.id, { ...base, excerpt: null, postId: null, member: member(user) });
      }
    }
    return targets;
  }
}
