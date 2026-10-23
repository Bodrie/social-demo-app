import { Injectable } from '@nestjs/common';
import { isEmojiOnly } from '@beso/shared';
import {
  type AchievementSeries,
  BESO_OPENING,
  FOUNDING_PERIOD_DAYS,
} from '@beso/shared/achievements';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type ClockCheck,
  clockMatches,
  hasHalloweenEmoji,
  hasKiss,
  isFullLength,
  isPalindrome,
  localHour,
} from './content-checks.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPENING = new Date(BESO_OPENING);
const FOUNDING_ENDS = new Date(OPENING.getTime() + FOUNDING_PERIOD_DAYS * DAY_MS);
/** "One of the first 100": the member's place among the accounts that exist. */
const FIRST_MEMBERS = 100;

/** The series counted from the member's own badges rather than from their doings. */
export type DerivedSeries = Extract<
  AchievementSeries,
  'getting-started' | 'collected' | 'hidden-found'
>;
export type CountedSeries = Exclude<AchievementSeries, DerivedSeries>;

export const DERIVED_SERIES: readonly DerivedSeries[] = [
  'getting-started',
  'collected',
  'hidden-found',
];
export const isDerived = (series: AchievementSeries): series is DerivedSeries =>
  (DERIVED_SERIES as readonly AchievementSeries[]).includes(series);

/** What the counters need to know about the member themselves. */
export type CountedMember = {
  id: string;
  createdAt: Date;
  avatarKey: string | null;
  coverKey: string | null;
  /** A ready-made picture counts as one's picture (Say cheese, Widescreen, The full picture). */
  avatarPreset: string | null;
  coverPreset: string | null;
  bio: string | null;
  city: string | null;
  website: string | null;
  /** From `settings.timeZone`: the clock badges count nothing without one. */
  timeZone: string | null;
};

const filled = (value: string | null): boolean => value !== null && value.trim() !== '';
const flag = (value: boolean): number => (value ? 1 : 0);

type PostText = { createdAt: Date; content: string };

/** What one check reads of the member's own items, each loaded at most once per check. */
class History {
  private postsLoad?: Promise<PostText[]>;
  private commentsLoad?: Promise<Date[]>;
  private messagesLoad?: Promise<Date[]>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly userId: string,
  ) {}

  posts(): Promise<PostText[]> {
    this.postsLoad ??= this.prisma.post.findMany({
      where: { authorId: this.userId },
      select: { createdAt: true, content: true },
    });
    return this.postsLoad;
  }

  async commentTimes(): Promise<Date[]> {
    this.commentsLoad ??= this.prisma.comment
      .findMany({ where: { authorId: this.userId }, select: { createdAt: true } })
      .then((rows) => rows.map((row) => row.createdAt));
    return this.commentsLoad;
  }

  async messageTimes(): Promise<Date[]> {
    this.messagesLoad ??= this.prisma.message
      .findMany({ where: { senderId: this.userId, kind: 'user' }, select: { createdAt: true } })
      .then((rows) => rows.map((row) => row.createdAt));
    return this.messagesLoad;
  }
}

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
    const history = new History(this.prisma, member.id);
    const counts = await Promise.all(series.map((name) => this.one(member, name, now, history)));
    return new Map(series.map((name, index) => [name, counts[index] ?? 0]));
  }

  /**
   * The members who first used one of the post's tags: a newcomer to a tag may have just made
   * its originator a Trendsetter.
   */
  async tagOriginators(postId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ authorId: string }[]>`
      SELECT DISTINCT first.author_id AS "authorId"
      FROM (
        SELECT DISTINCT ON (ph.tag) ph.tag, p.author_id
        FROM post_hashtags AS ph
        JOIN posts AS p ON p.id = ph.post_id
        WHERE ph.tag IN (SELECT tag FROM post_hashtags WHERE post_id = ${postId}::uuid)
        ORDER BY ph.tag, ph.created_at, ph.post_id
      ) AS first`;
    return rows.map((row) => row.authorId);
  }

  private async one(
    member: CountedMember,
    series: CountedSeries,
    now: Date,
    history: History,
  ): Promise<number> {
    const userId = member.id;
    const zone = member.timeZone;
    switch (series) {
      case 'avatar':
        return flag(member.avatarKey !== null || member.avatarPreset !== null);
      case 'cover':
        return flag(member.coverKey !== null || member.coverPreset !== null);
      case 'bio':
        return flag(filled(member.bio));
      case 'full-profile':
        return flag(
          (member.avatarKey !== null || member.avatarPreset !== null) &&
            (member.coverKey !== null || member.coverPreset !== null) &&
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
          this.one(member, 'reposts', now, history),
          this.one(member, 'quotes', now, history),
        ]);
        return reposts + quotes;
      }
      case 'messages':
        return this.prisma.message.count({ where: { senderId: userId, kind: 'user' } });
      case 'groups-created':
        return this.prisma.conversation.count({ where: { createdById: userId, kind: 'group' } });
      case 'polls':
        return this.prisma.poll.count({ where: { post: { authorId: userId } } });
      case 'poll-votes':
        return this.prisma.pollVote.count({ where: { userId } });
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

      // Recognition
      case 'followers':
        return this.prisma.follow.count({ where: { followeeId: userId } });
      case 'likes-received':
        return this.prisma.postLike.count({ where: { post: { authorId: userId } } });
      case 'top-post-likes':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(n), 0)::int AS count FROM (
            SELECT COUNT(*) AS n FROM post_likes AS pl
            JOIN posts AS p ON p.id = pl.post_id
            WHERE p.author_id = ${userId}::uuid
            GROUP BY pl.post_id
          ) AS per_post`);
      case 'top-post-comments':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(n), 0)::int AS count FROM (
            SELECT COUNT(*) AS n FROM comments AS c
            JOIN posts AS p ON p.id = c.post_id
            WHERE p.author_id = ${userId}::uuid AND c.author_id <> ${userId}::uuid
            GROUP BY c.post_id
          ) AS per_post`);
      case 'top-comment-reactions':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(reactions_count), 0)::int AS count
          FROM comments WHERE author_id = ${userId}::uuid`);
      case 'top-poll-votes':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(n), 0)::int AS count FROM (
            SELECT COUNT(*) AS n FROM poll_votes AS pv
            JOIN posts AS p ON p.id = pv.post_id
            WHERE p.author_id = ${userId}::uuid
            GROUP BY pv.post_id
          ) AS per_poll`);
      case 'top-post-reposts':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(repost_count), 0)::int AS count
          FROM posts WHERE author_id = ${userId}::uuid`);
      case 'mentioned-by':
        return this.scalar(Prisma.sql`
          SELECT COUNT(DISTINCT author_id)::int AS count FROM (
            SELECT p.author_id FROM post_mentions AS pm
            JOIN posts AS p ON p.id = pm.post_id
            WHERE pm.user_id = ${userId}::uuid
            UNION
            SELECT c.author_id FROM comment_mentions AS cm
            JOIN comments AS c ON c.id = cm.comment_id
            WHERE cm.user_id = ${userId}::uuid
          ) AS mentioners
          WHERE author_id <> ${userId}::uuid`);
      case 'trendsetter':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM (
            SELECT DISTINCT ON (ph.tag) ph.tag, p.author_id
            FROM post_hashtags AS ph
            JOIN posts AS p ON p.id = ph.post_id
            WHERE ph.tag IN (
              SELECT ph2.tag FROM post_hashtags AS ph2
              JOIN posts AS p2 ON p2.id = ph2.post_id
              WHERE p2.author_id = ${userId}::uuid
            )
            ORDER BY ph.tag, ph.created_at, ph.post_id
          ) AS first
          WHERE first.author_id = ${userId}::uuid
            AND (
              SELECT COUNT(DISTINCT p3.author_id) FROM post_hashtags AS ph3
              JOIN posts AS p3 ON p3.id = ph3.post_id
              WHERE ph3.tag = first.tag AND p3.author_id <> ${userId}::uuid
            ) >= 5`);

      // Community
      case 'newcomers-welcomed':
        return this.scalar(Prisma.sql`
          SELECT COUNT(DISTINCT t.member_id)::int AS count FROM (
            SELECT f.followee_id AS member_id, f.created_at AS at
            FROM follows AS f WHERE f.follower_id = ${userId}::uuid
            UNION ALL
            SELECT p.author_id, c.created_at
            FROM comments AS c JOIN posts AS p ON p.id = c.post_id
            WHERE c.author_id = ${userId}::uuid
          ) AS t
          JOIN users AS u ON u.id = t.member_id
          WHERE u.id <> ${userId}::uuid AND t.at < u.created_at + interval '7 days'`);
      case 'first-responses':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM (
            SELECT DISTINCT ON (c.post_id) c.post_id, c.author_id
            FROM comments AS c
            WHERE c.post_id IN (SELECT post_id FROM comments WHERE author_id = ${userId}::uuid)
            ORDER BY c.post_id, c.created_at, c.id
          ) AS first
          JOIN posts AS p ON p.id = first.post_id
          WHERE first.author_id = ${userId}::uuid AND p.author_id <> ${userId}::uuid`);
      case 'mutual-follows':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM follows AS a
          JOIN follows AS b ON b.follower_id = a.followee_id AND b.followee_id = a.follower_id
          WHERE a.follower_id = ${userId}::uuid`);
      case 'crew':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(n), 0)::int AS count FROM (
            SELECT COUNT(*) AS n FROM conversations AS c
            JOIN conversation_members AS m ON m.conversation_id = c.id
            WHERE c.created_by_id = ${userId}::uuid AND c.kind = 'group'
            GROUP BY c.id
          ) AS groups`);
      case 'big-table':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(n), 0)::int AS count FROM (
            SELECT COUNT(*) AS n FROM conversation_members AS m
            JOIN conversations AS c ON c.id = m.conversation_id
            WHERE c.kind = 'group' AND m.conversation_id IN (
              SELECT conversation_id FROM conversation_members WHERE user_id = ${userId}::uuid
            )
            GROUP BY m.conversation_id
          ) AS groups`);
      case 'recruits':
        return this.prisma.user.count({
          where: { invitedById: userId, emailVerifiedAt: { not: null } },
        });

      // Hidden: the clock
      case 'night-owl': {
        if (zone === null) return 0;
        const [posts, comments] = await Promise.all([history.posts(), history.commentTimes()]);
        const times = [...posts.map((post) => post.createdAt), ...comments];
        return times.filter((at) => clockMatches('night-owl', at, zone)).length;
      }
      case 'early-bird':
      case 'make-a-wish':
      case 'weekend-posts':
      case 'new-year':
      case 'leap-day':
      case 'friday-13':
        return this.postsAt(history, zone, series);
      case 'trick-or-treat': {
        if (zone === null) return 0;
        const posts = await history.posts();
        return posts.filter(
          (post) =>
            hasHalloweenEmoji(post.content) && clockMatches('halloween', post.createdAt, zone),
        ).length;
      }
      case 'around-the-clock': {
        if (zone === null) return 0;
        const [posts, comments, messages] = await Promise.all([
          history.posts(),
          history.commentTimes(),
          history.messageTimes(),
        ]);
        const times = [...posts.map((post) => post.createdAt), ...comments, ...messages];
        return new Set(times.map((at) => localHour(at, zone))).size;
      }

      // Hidden: the words
      case 'un-beso': {
        const [posts, messages] = await Promise.all([
          history.posts(),
          this.prisma.message.count({
            where: {
              senderId: userId,
              kind: 'user',
              OR: [{ content: { contains: '😘' } }, { content: { contains: '💋' } }],
            },
          }),
        ]);
        return posts.filter((post) => hasKiss(post.content)).length + messages;
      }
      case 'home-team':
        return this.prisma.postHashtag.count({
          where: { tag: 'beso', post: { authorId: userId } },
        });
      case 'emoji-only':
        return (await history.posts()).filter((post) => isEmojiOnly(post.content)).length;
      case 'palindrome':
        return (await history.posts()).filter((post) => isPalindrome(post.content)).length;
      case 'full-length':
        return (await history.posts()).filter((post) => isFullLength(post.content)).length;

      // Hidden: the timing and the rest
      case 'quick-draw':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM comments AS c
          JOIN comments AS parent ON parent.id = c.parent_id
          WHERE c.author_id = ${userId}::uuid AND parent.author_id <> ${userId}::uuid
            AND c.created_at <= parent.created_at + interval '1 minute'`);
      case 'archaeologist':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM comments AS c
          JOIN posts AS p ON p.id = c.post_id
          WHERE c.author_id = ${userId}::uuid AND c.created_at > p.created_at + interval '1 year'`);
      case 'welcome-back':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM (
            SELECT created_at - LAG(created_at) OVER (ORDER BY created_at, id) AS gap
            FROM posts WHERE author_id = ${userId}::uuid
          ) AS gaps
          WHERE gap >= interval '60 days'`);
      case 'perfectionist':
        return this.scalar(Prisma.sql`
          SELECT COALESCE(MAX(n), 0)::int AS count FROM (
            SELECT COUNT(*) AS n FROM post_revisions AS r
            JOIN posts AS p ON p.id = r.post_id
            WHERE p.author_id = ${userId}::uuid
            GROUP BY r.post_id
          ) AS per_post`);
      case 'inception':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM posts AS p
          JOIN posts AS quoted ON quoted.id = p.quoted_post_id
          WHERE p.author_id = ${userId}::uuid AND quoted.was_quote`);
      case 'full-range': {
        const types = await this.prisma.commentReaction.groupBy({
          by: ['type'],
          where: { userId },
        });
        return types.length;
      }
      case 'self-reply':
        return this.scalar(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM comments AS c
          JOIN comments AS parent ON parent.id = c.parent_id
          WHERE c.author_id = ${userId}::uuid AND parent.author_id = ${userId}::uuid`);
      default: {
        const unknown: never = series;
        throw new Error(`No counter for the series ${String(unknown)}`);
      }
    }
  }

  /** The member's posts whose local time matches (none without a time zone). */
  private async postsAt(history: History, zone: string | null, check: ClockCheck): Promise<number> {
    if (zone === null) return 0;
    const posts = await history.posts();
    return posts.filter((post) => clockMatches(check, post.createdAt, zone)).length;
  }

  /** A query that answers one `count` column. */
  private async scalar(query: Prisma.Sql): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>(query);
    return row?.count ?? 0;
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
