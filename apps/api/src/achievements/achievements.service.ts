import { Injectable, Logger } from '@nestjs/common';
import {
  ACHIEVEMENT_SERIES,
  ACHIEVEMENT_BY_KEY,
  type AchievementDefinition,
  type AchievementList,
  ACHIEVEMENTS,
  type AchievementSeries,
  type AchievementStats,
  type EarnedAchievement,
  GETTING_STARTED_KEYS,
  type MyAchievements,
} from '@beso/shared/achievements';
import { notFound } from '../common/errors.js';
import { VisibilityService } from '../moderation/visibility.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserSettings } from '../users/users.mapper.js';
import {
  AchievementCounter,
  type CountedMember,
  type CountedSeries,
  type DerivedSeries,
  isDerived,
} from './achievement-counter.js';

/** How long `GET /achievements/stats` answers from memory. */
export const ACHIEVEMENT_STATS_TTL_MS = 60 * 60 * 1000;
/** Members per page of the daily sweep. */
const SWEEP_PAGE = 200;

type Member = CountedMember & { achievementsCheckedAt: Date | null };

const memberSelect = {
  id: true,
  createdAt: true,
  avatarKey: true,
  coverKey: true,
  bio: true,
  city: true,
  website: true,
  settings: true,
  achievementsCheckedAt: true,
} as const;

/** Series whose every badge is hidden: their counts would give the riddles away. */
const HIDDEN_ONLY = new Set<AchievementSeries>(
  ACHIEVEMENT_SERIES.filter((series) =>
    ACHIEVEMENTS.filter((achievement) => achievement.series === series).every(
      (achievement) => achievement.hidden,
    ),
  ),
);

/** Members whose badges are counted: confirmed and not suspended. */
const counted = { emailVerifiedAt: { not: null }, suspendedAt: null } as const;

const toEarned = (row: { key: string; earnedAt: Date }): EarnedAchievement => ({
  key: row.key,
  earnedAt: row.earnedAt.toISOString(),
});

/**
 * Badges (F2, ADR 0021). `check` counts the series an event touched and awards every badge
 * reached and not yet held; earned is earned, so nothing is ever taken back. An account from
 * before F2 is counted once in full and silently first (`backfill`), so its first check after
 * the deploy announces only what is new from then on.
 */
@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);
  private statsCache: { at: number; value: AchievementStats } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly counter: AchievementCounter,
    private readonly notifications: NotificationsService,
    private readonly visibility: VisibilityService,
  ) {}

  /** Awards and announces what the member reached in `series`; returns the new keys. */
  async check(
    userId: string,
    series: readonly AchievementSeries[],
    now = new Date(),
  ): Promise<string[]> {
    const member = await this.member(userId);
    if (!member) return [];
    await this.backfill(member, now);
    const earned = await this.award(member, series, now);
    for (const key of earned) {
      // oxlint-disable-next-line no-await-in-loop -- one notification after the other, in catalogue order
      await this.notifications.notify({
        userId,
        type: 'ACHIEVEMENT_EARNED',
        actorId: null,
        achievementKey: key,
      });
    }
    return earned;
  }

  /** Whoever first used one of the post's tags may have just become a Trendsetter. */
  async checkTagOriginators(postId: string, now = new Date()): Promise<void> {
    for (const userId of await this.counter.tagOriginators(postId)) {
      // oxlint-disable-next-line no-await-in-loop -- a post has a handful of tags
      await this.check(userId, ['trendsetter'], now);
    }
  }

  /** A group changed hands or size: its creator's Crew, everyone's Big table. */
  async checkGroup(conversationId: string, now = new Date()): Promise<void> {
    const group = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { kind: true, createdById: true, members: { select: { userId: true } } },
    });
    if (!group || group.kind !== 'group') return;
    const size = group.members.length;
    if (group.createdById && size >= thresholdOf('crew')) {
      await this.check(group.createdById, ['crew'], now);
    }
    if (size < thresholdOf('big-table')) return;
    for (const { userId } of group.members) {
      // oxlint-disable-next-line no-await-in-loop -- one member at a time keeps the pool free
      await this.check(userId, ['big-table'], now);
    }
  }

  /** A newcomer confirmed their address: whoever invited them counts one more recruit. */
  async checkInviterOf(userId: string, now = new Date()): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { invitedById: true },
    });
    if (user?.invitedById) await this.check(user.invitedById, ['recruits'], now);
  }

  /**
   * The daily sweep (JobsService): every series of every counted member, for tenure and for
   * whatever a failed listener missed. One member's failure is logged and the rest go on.
   * Returns the number of badges awarded.
   */
  async sweep(now: Date): Promise<number> {
    let awarded = 0;
    let after: string | undefined;
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- page after page, on purpose
      const page = await this.prisma.user.findMany({
        where: { ...counted, ...(after ? { id: { gt: after } } : {}) },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: SWEEP_PAGE,
      });
      for (const { id } of page) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- one member at a time keeps the pool free
          awarded += (await this.check(id, ACHIEVEMENT_SERIES, now)).length;
        } catch (error) {
          this.logger.error({ err: error, userId: id }, 'Could not check achievements');
        }
      }
      if (page.length < SWEEP_PAGE) return awarded;
      after = page.at(-1)?.id;
    }
  }

  /**
   * `GET /users/:id/achievements`: what the member earned. Empty when they hide their badges
   * (from everyone but themselves), across a block and for a suspended member.
   */
  async list(viewerId: string, userId: string): Promise<AchievementList> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true, suspendedAt: true },
    });
    if (!user) throw notFound('User not found');
    if (viewerId !== userId) {
      const hidden =
        !toUserSettings(user.settings).showAchievements ||
        user.suspendedAt !== null ||
        (await this.visibility.isBlockedBetween(viewerId, userId));
      if (hidden) return { items: [], nextCursor: null };
    }
    // An account from before F2 that nothing has counted yet shows its badges at once.
    const member = await this.member(userId);
    if (member) await this.backfill(member, new Date());
    return { items: await this.earned(userId), nextCursor: null };
  }

  /**
   * `GET /users/me/achievements`: the earned badges and the count of every series but the
   * hidden ones (their counts would give them away).
   */
  async mine(userId: string, now = new Date()): Promise<MyAchievements> {
    const member = await this.member(userId);
    if (!member) return { earned: [], progress: {} };
    await this.backfill(member, now);
    const earned = await this.earned(userId);
    const shown = ACHIEVEMENT_SERIES.filter((series) => !HIDDEN_ONLY.has(series));
    const counts = await this.counter.count(member, countedSeries(shown), now);
    const held = new Set(earned.map((row) => row.key));
    const progress: Record<string, number> = Object.fromEntries(counts);
    progress['getting-started'] = derivedCount('getting-started', held);
    progress.collected = derivedCount('collected', held);
    return { earned, progress };
  }

  /** Holders per badge and the number of counted members, from memory for an hour. */
  async stats(now = new Date()): Promise<AchievementStats> {
    if (this.statsCache && now.getTime() - this.statsCache.at < ACHIEVEMENT_STATS_TTL_MS) {
      return this.statsCache.value;
    }
    const [members, groups] = await Promise.all([
      this.prisma.user.count({ where: counted }),
      this.prisma.userAchievement.groupBy({
        by: ['key'],
        where: { user: counted },
        _count: { userId: true },
      }),
    ]);
    const value: AchievementStats = {
      members,
      items: groups
        .filter((group) => ACHIEVEMENT_BY_KEY.has(group.key))
        .map((group) => ({ key: group.key, holders: group._count.userId })),
      nextCursor: null,
    };
    this.statsCache = { at: now.getTime(), value };
    return value;
  }

  private async member(userId: string): Promise<Member | null> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, ...counted },
      select: memberSelect,
    });
    if (!row) return null;
    const { settings, ...member } = row;
    return { ...member, timeZone: toUserSettings(settings).timeZone };
  }

  /** Newest first; keys a later version dropped from the catalogue stay out. */
  private async earned(userId: string): Promise<EarnedAchievement[]> {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { key: true, earnedAt: true },
      orderBy: [{ earnedAt: 'desc' }, { key: 'asc' }],
    });
    return rows.filter((row) => ACHIEVEMENT_BY_KEY.has(row.key)).map(toEarned);
  }

  /** The first count of an account from before F2: whatever it reached, without a word. */
  private async backfill(member: Member, now: Date): Promise<void> {
    if (member.achievementsCheckedAt !== null) return;
    await this.award(member, ACHIEVEMENT_SERIES, now);
    await this.prisma.user.updateMany({
      where: { id: member.id, achievementsCheckedAt: null },
      data: { achievementsCheckedAt: now },
    });
    member.achievementsCheckedAt = now;
  }

  /**
   * Stores every badge of `series` the counts reach and the member does not hold yet; the
   * badges that count badges ("All set", Collector) settle afterwards. Two checks racing each
   * other insert each badge once: only the inserted rows come back.
   */
  private async award(
    member: Member,
    series: readonly AchievementSeries[],
    now: Date,
  ): Promise<string[]> {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId: member.id },
      select: { key: true },
    });
    const held = new Set(rows.map((row) => row.key));
    const wanted = new Set(series);
    const open = ACHIEVEMENTS.filter(
      (achievement) => wanted.has(achievement.series) && !held.has(achievement.key),
    );
    const toCount = countedSeries([...new Set(open.map((achievement) => achievement.series))]);
    const counts = await this.counter.count(member, toCount, now);
    const earned = await this.insert(
      member.id,
      open.filter(
        (achievement) =>
          !isDerived(achievement.series) &&
          (counts.get(achievement.series) ?? 0) >= achievement.threshold,
      ),
      now,
    );
    for (const key of earned) held.add(key);
    if (earned.length === 0 && !series.some(isDerived)) return earned;
    // "All set" can tip Collector over a threshold, so settle until nothing new comes.
    for (;;) {
      const reached = ACHIEVEMENTS.filter(
        (achievement) =>
          isDerived(achievement.series) &&
          !held.has(achievement.key) &&
          derivedCount(achievement.series, held) >= achievement.threshold,
      );
      // oxlint-disable-next-line no-await-in-loop -- each round depends on the one before
      const more = await this.insert(member.id, reached, now);
      if (more.length === 0) return earned;
      for (const key of more) held.add(key);
      earned.push(...more);
    }
  }

  private async insert(
    userId: string,
    achievements: readonly AchievementDefinition[],
    now: Date,
  ): Promise<string[]> {
    if (achievements.length === 0) return [];
    const rows = await this.prisma.userAchievement.createManyAndReturn({
      data: achievements.map((achievement) => ({ userId, key: achievement.key, earnedAt: now })),
      skipDuplicates: true,
      select: { key: true },
    });
    const inserted = new Set(rows.map((row) => row.key));
    // Catalogue order, so the notifications read from the first badge to the last.
    return achievements.map((achievement) => achievement.key).filter((key) => inserted.has(key));
  }
}

/** The smallest threshold of a series: below it there is nothing to check. */
function thresholdOf(series: AchievementSeries): number {
  return Math.min(
    ...ACHIEVEMENTS.filter((achievement) => achievement.series === series).map(
      (achievement) => achievement.threshold,
    ),
  );
}

function countedSeries(series: readonly AchievementSeries[]): CountedSeries[] {
  return series.filter((name): name is CountedSeries => !isDerived(name));
}

function derivedCount(series: DerivedSeries, held: ReadonlySet<string>): number {
  if (series === 'getting-started') {
    return GETTING_STARTED_KEYS.filter((key) => held.has(key)).length;
  }
  const known = [...held].flatMap((key) => ACHIEVEMENT_BY_KEY.get(key) ?? []);
  return series === 'collected'
    ? known.length
    : known.filter((achievement) => achievement.hidden).length;
}
