import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CursorQuery, Notification, Paginated, UnreadCount } from '@beso/shared';
import { AssetsService } from '../assets/assets.service.js';
import { notFound } from '../common/errors.js';
import { decodeCursor, keysetAfter, paginate } from '../common/pagination.js';
import { NotificationCreatedEvent } from '../events/notification.events.js';
import type { NotificationType, Prisma } from '../generated/prisma/client.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { notificationSelect, toNotification } from './notifications.mapper.js';

/** Rows older than this are removed by the daily jobs; nobody scrolls back that far. */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** Who is told about what; the subjects a type carries. Only a badge has no actor. */
export type NotificationInput = {
  userId: string;
  type: NotificationType;
  actorId: string | null;
  postId?: string | null;
  commentId?: string | null;
  achievementKey?: string | null;
};

/**
 * What happened to a member's own things (ADR 0015). Rows are written by the listener from
 * domain events; the member reads them newest first, counts the unread ones and marks them
 * read. Chat is not here: conversations keep their own unread counts.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly assets: AssetsService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * Nothing from someone the member blocked, who blocked them, or whom they muted (ADR 0016).
   * Actor-less rows (badges) always pass: `NOT IN` alone would drop their null.
   */
  private async silenced(userId: string): Promise<Prisma.NotificationWhereInput> {
    const hidden = await this.visibility.hiddenAuthorIds(userId);
    return { OR: [{ actorId: null }, { actorId: { notIn: hidden } }] };
  }

  async list(userId: string, query: CursorQuery): Promise<Paginated<Notification>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.notification.findMany({
      where: {
        AND: [
          { userId },
          await this.silenced(userId),
          cursor ? keysetAfter(cursor, (id) => ({ id: { lt: id } })) : {},
        ],
      },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => toNotification(row, this.assets.base));
  }

  async unreadCount(userId: string): Promise<UnreadCount> {
    const count = await this.prisma.notification.count({
      where: { AND: [{ userId, readAt: null }, await this.silenced(userId)] },
    });
    return { count };
  }

  /** Everything up to now; the page calls it when it opens. */
  async markAllRead(userId: string, now = new Date()): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    });
  }

  /** One notification; a second call leaves the first mark alone. Somebody else's is a 404. */
  async markRead(userId: string, id: string, now = new Date()): Promise<void> {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { readAt: true },
    });
    if (!row) throw notFound('Notification not found');
    if (row.readAt !== null) return;
    await this.prisma.notification.update({ where: { id }, data: { readAt: now } });
  }

  /**
   * Writes the notification and pushes it. Nobody is told about their own doing. A repeat of
   * the same event (a reaction removed and put back, a mention edited out and in) refreshes
   * the one row, new and unread again, rather than adding another; the unique key covers the
   * types whose subjects are all set, this lookup the ones with a null subject. A badge has no
   * actor, so those two rules do not apply to it.
   */
  async notify(input: NotificationInput): Promise<Notification | null> {
    if (input.actorId !== null) {
      if (input.userId === input.actorId) return null;
      // Nothing from someone the recipient blocked, who blocked them, or whom they muted (ADR 0016).
      if (await this.visibility.isSilencedFor(input.userId, input.actorId)) return null;
    }
    const key = {
      userId: input.userId,
      type: input.type,
      actorId: input.actorId,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
      achievementKey: input.achievementKey ?? null,
    };
    const existing = await this.prisma.notification.findFirst({ where: key, select: { id: true } });
    const row = existing
      ? await this.prisma.notification.update({
          where: { id: existing.id },
          data: { createdAt: new Date(), readAt: null },
          select: notificationSelect,
        })
      : await this.prisma.notification.create({ data: key, select: notificationSelect });
    const notification = toNotification(row, this.assets.base);
    await this.events.emitAsync(
      NotificationCreatedEvent.EVENT,
      new NotificationCreatedEvent(input.userId, notification),
    );
    return notification;
  }

  /** An undone action (unlike, unfollow) takes its notification with it, read or not. */
  async retract(where: {
    type: NotificationType;
    actorId: string;
    userId?: string;
    postId?: string;
  }): Promise<void> {
    await this.prisma.notification.deleteMany({ where });
  }

  /** Housekeeping (JobsService). Returns the count. */
  async deleteOlderThan(before: Date): Promise<number> {
    const { count } = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: before } },
    });
    return count;
  }
}
