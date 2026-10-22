import { Injectable } from '@nestjs/common';
import {
  type AchievementSeries,
  BESO_OPENING,
  FOUNDING_PERIOD_DAYS,
} from '@beso/shared/achievements';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPENING = new Date(BESO_OPENING);
const FOUNDING_ENDS = new Date(OPENING.getTime() + FOUNDING_PERIOD_DAYS * DAY_MS);
/** "One of the first 100": the member's place among the accounts that exist. */
const FIRST_MEMBERS = 100;

/** The series counted from the member's own badges rather than from their doings. */
export type DerivedSeries = Extract<AchievementSeries, 'getting-started' | 'collected'>;
export type CountedSeries = Exclude<AchievementSeries, DerivedSeries>;

export const DERIVED_SERIES: readonly DerivedSeries[] = ['getting-started', 'collected'];
export const isDerived = (series: AchievementSeries): series is DerivedSeries =>
  (DERIVED_SERIES as readonly AchievementSeries[]).includes(series);

/** What the counters need to know about the member themselves. */
export type CountedMember = {
  id: string;
  createdAt: Date;
  avatarKey: string | null;
  coverKey: string | null;
  bio: string | null;
  city: string | null;
  website: string | null;
};

const filled = (value: string | null): boolean => value !== null && value.trim() !== '';
const flag = (value: boolean): number => (value ? 1 : 0);

/**
 * One count per series (F2, ADR 0021). Badges are evaluated by counting what is there, never by
 * keeping a tally, so a check is idempotent and holds after deletions; every count here runs on
 * an index that starts with the member's id.
 */
@Injectable()
export class AchievementCounter {
  constructor(private readonly prisma: PrismaService) {}

  async count(
    member: CountedMember,
    series: readonly CountedSeries[],
    now: Date,
  ): Promise<Map<CountedSeries, number>> {
    const counts = await Promise.all(series.map((name) => this.one(member, name, now)));
    return new Map(series.map((name, index) => [name, counts[index] ?? 0]));
  }

  private async one(member: CountedMember, series: CountedSeries, now: Date): Promise<number> {
    const userId = member.id;
    switch (series) {
      case 'avatar':
        return flag(member.avatarKey !== null);
      case 'cover':
        return flag(member.coverKey !== null);
      case 'bio':
        return flag(filled(member.bio));
      case 'full-profile':
        return flag(
          member.avatarKey !== null &&
            member.coverKey !== null &&
            filled(member.bio) &&
            filled(member.city) &&
            filled(member.website),
        );
      case 'following':
        return this.prisma.follow.count({ where: { followerId: userId } });
      case 'posts':
        return this.prisma.post.count({ where: { authorId: userId } });
      case 'comments':
        return this.prisma.comment.count({ where: { authorId: userId } });
      case 'replies':
        return this.prisma.comment.count({ where: { authorId: userId, parentId: { not: null } } });
      case 'picture-posts':
        return this.prisma.post.count({ where: { authorId: userId, images: { some: {} } } });
      case 'pictures':
        return this.prisma.postImage.count({ where: { post: { authorId: userId } } });
      case 'hashtag-posts':
        return this.prisma.post.count({ where: { authorId: userId, hashtags: { some: {} } } });
      case 'tags':
        return this.distinctTags(userId);
      case 'mentions-given': {
        const [inPosts, inComments] = await Promise.all([
          this.prisma.postMention.count({ where: { post: { authorId: userId } } }),
          this.prisma.commentMention.count({ where: { comment: { authorId: userId } } }),
        ]);
        return inPosts + inComments;
      }
      case 'reposts':
        return this.prisma.repost.count({ where: { userId } });
      case 'quotes':
        return this.prisma.post.count({ where: { authorId: userId, wasQuote: true } });
      case 'amplified': {
        const [reposts, quotes] = await Promise.all([
          this.one(member, 'reposts', now),
          this.one(member, 'quotes', now),
        ]);
        return reposts + quotes;
      }
      case 'messages':
        return this.prisma.message.count({ where: { senderId: userId, kind: 'user' } });
      case 'groups-created':
        return this.prisma.conversation.count({ where: { createdById: userId, kind: 'group' } });
      case 'likes-given':
        return this.prisma.postLike.count({ where: { userId } });
      case 'reactions-given': {
        const [onComments, onMessages] = await Promise.all([
          this.prisma.commentReaction.count({ where: { userId } }),
          this.prisma.messageReaction.count({ where: { userId } }),
        ]);
        return onComments + onMessages;
      }
      case 'bookmarks':
        return this.prisma.bookmark.count({ where: { userId } });
      case 'push-devices':
        return this.prisma.pushSubscription.count({ where: { userId } });
      case 'membership-days':
        return Math.max(0, Math.floor((now.getTime() - member.createdAt.getTime()) / DAY_MS));
      case 'pioneer':
        return flag(member.createdAt < OPENING);
      case 'founding':
        return flag(member.createdAt >= OPENING && member.createdAt < FOUNDING_ENDS);
      case 'first-100':
        return flag((await this.placeOf(member)) <= FIRST_MEMBERS);
      default: {
        const unknown: never = series;
        throw new Error(`No counter for the series ${String(unknown)}`);
      }
    }
  }

  private async distinctTags(userId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<[{ count: number }]>`
      SELECT COUNT(DISTINCT ph.tag)::int AS count
      FROM post_hashtags AS ph
      JOIN posts AS p ON p.id = ph.post_id
      WHERE p.author_id = ${userId}::uuid`;
    return row.count;
  }

  /** 1 for the oldest account; ties on the timestamp go by id, like every keyset here. */
  private async placeOf(member: CountedMember): Promise<number> {
    const earlier = await this.prisma.user.count({
      where: {
        OR: [
          { createdAt: { lt: member.createdAt } },
          { createdAt: member.createdAt, id: { lt: member.id } },
        ],
      },
    });
    return earlier + 1;
  }
}
