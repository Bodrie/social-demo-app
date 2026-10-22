import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENT_GROUP_TITLES,
  ACHIEVEMENT_TIER_TITLES,
  ACHIEVEMENTS,
  type AchievementStats,
} from '@beso/shared/achievements';
import dayjs from 'dayjs';
import { AwardIcon, CircleHelpIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { useProfileContext } from '@/features/profile/profile-context';
import { useUpdateSettings } from '@/features/settings/use-settings';
import { firstName } from '@/lib/names';
import { type BadgeTile, earnedMap, rarityOf, tilesOf } from './badge-tiles';
import { Medallion } from './medallion';
import { useAchievementStats, useMyAchievements, useUserAchievements } from './use-achievements';

const VISIBLE_TOTAL = ACHIEVEMENTS.filter((achievement) => !achievement.hidden).length;
const HIDDEN_TOTAL = ACHIEVEMENTS.length - VISIBLE_TOTAL;
const isHidden = (key: string): boolean =>
  ACHIEVEMENTS.some((achievement) => achievement.key === key && achievement.hidden);

/** `/u/:username/badges`: the member's own badges with progress, or what another one earned. */
export function ProfileBadges() {
  const { user } = useProfileContext();
  const me = useCurrentUser();
  return user.id === me.id ? <MyBadges /> : <TheirBadges userId={user.id} name={user.name} />;
}

function MyBadges() {
  const me = useCurrentUser();
  const update = useUpdateSettings();
  const query = useMyAchievements();
  const stats = useAchievementStats();
  if (query.isPending) return <BadgesSkeleton />;
  if (query.isError) {
    return (
      <ErrorState message="Could not load your badges." onRetry={() => void query.refetch()} />
    );
  }
  const earned = earnedMap(query.data.earned);
  const found = [...earned.keys()].filter(isHidden).length;
  const checklistHidden = me.settings.hideGettingStarted && !earned.has('all-set');
  return (
    <div className="space-y-4">
      <div className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4 text-sm">
        <p>
          You have <strong className="tabular-nums">{earned.size - found}</strong> of{' '}
          <span className="tabular-nums">{VISIBLE_TOTAL}</span> badges and found{' '}
          <strong className="tabular-nums">{found}</strong> of{' '}
          <span className="tabular-nums">{HIDDEN_TOTAL}</span> hidden ones.
        </p>
        {checklistHidden ? (
          <Button
            variant="outline"
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ hideGettingStarted: false })}
          >
            Show Getting started on Home
          </Button>
        ) : null}
      </div>
      {ACHIEVEMENT_GROUPS.map((group) => {
        const tiles = tilesOf(group, earned).filter(
          (tile) => tile.earned !== null || !(tile.next?.hidden ?? false),
        );
        const secrets = group === 'hidden' ? <SecretTile found={found} /> : null;
        return tiles.length === 0 && !secrets ? null : (
          <BadgeGroup
            key={group}
            title={ACHIEVEMENT_GROUP_TITLES[group]}
            tiles={tiles}
            progress={query.data.progress}
            stats={stats.data}
            extra={secrets}
          />
        );
      })}
    </div>
  );
}

function TheirBadges({ userId, name }: { userId: string; name: string }) {
  const query = useUserAchievements(userId);
  const stats = useAchievementStats();
  if (query.isPending) return <BadgesSkeleton />;
  if (query.isError) {
    return <ErrorState message="Could not load the badges." onRetry={() => void query.refetch()} />;
  }
  const earned = earnedMap(query.data.items);
  if (earned.size === 0) {
    return (
      <EmptyState
        icon={AwardIcon}
        title="No badges to show"
        description={`${firstName(name)} has no badges yet, or keeps them private.`}
      />
    );
  }
  return (
    <div className="space-y-4">
      {ACHIEVEMENT_GROUPS.map((group) => {
        const tiles = tilesOf(group, earned).filter((tile) => tile.earned !== null);
        return tiles.length === 0 ? null : (
          <BadgeGroup
            key={group}
            title={ACHIEVEMENT_GROUP_TITLES[group]}
            tiles={tiles}
            stats={stats.data}
          />
        );
      })}
    </div>
  );
}

type BadgeGroupProps = {
  title: string;
  tiles: BadgeTile[];
  /** The member's own counts: locked badges show how far along they are. */
  progress?: Record<string, number>;
  stats: AchievementStats | undefined;
  /** A last tile of the group's own (the hidden ones still to find). */
  extra?: ReactNode;
};

function BadgeGroup({ title, tiles, progress, stats, extra }: BadgeGroupProps) {
  return (
    <section aria-label={title} className="bg-card rounded-xl border p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <BadgeTileItem key={tile.id} tile={tile} progress={progress} stats={stats} />
        ))}
        {extra}
      </ul>
    </section>
  );
}

/** The hidden badges not found yet: a question mark and the count, no hints. */
function SecretTile({ found }: { found: number }) {
  const left = HIDDEN_TOTAL - found;
  if (left === 0) return null;
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground border-muted-foreground/40 inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-dashed"
      >
        <CircleHelpIcon className="size-7" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{left} more to find</p>
        <p className="text-muted-foreground">
          Hidden badges show here once you earn them. Some take a sense of humour, some a clock.
        </p>
      </div>
    </li>
  );
}

function BadgeTileItem({
  tile,
  progress,
  stats,
}: {
  tile: BadgeTile;
  progress?: Record<string, number>;
  stats: AchievementStats | undefined;
}) {
  const shown = tile.earned ?? tile.next;
  if (!shown) return null;
  const goal = progress ? tile.next : null;
  const count = goal ? Math.min(progress?.[goal.series] ?? 0, goal.threshold) : 0;
  const rarity = tile.earned ? rarityOf(tile.earned.key, stats) : null;
  return (
    <li className="flex gap-3">
      <Medallion achievement={shown} locked={tile.earned === null} size="lg" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {tile.title}
          {tile.earned?.tier ? (
            <span className="text-muted-foreground font-normal">
              {' '}
              · {ACHIEVEMENT_TIER_TITLES[tile.earned.tier]}
            </span>
          ) : null}
          {tile.earned === null ? <span className="sr-only"> (not earned yet)</span> : null}
        </p>
        <p className="text-muted-foreground">{(goal ?? shown).description}</p>
        {tile.earnedAt ? (
          <p className="text-muted-foreground text-xs">
            Earned {dayjs(tile.earnedAt).format('D MMMM YYYY')}
            {rarity ? ` · ${rarity} of members` : null}
          </p>
        ) : null}
        {goal && goal.threshold > 1 ? (
          <div className="mt-1.5 flex items-center gap-2">
            <progress
              aria-label={`${goal.title}${goal.tier ? ` (${ACHIEVEMENT_TIER_TITLES[goal.tier]})` : ''}`}
              value={count}
              max={goal.threshold}
              className="bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary h-1.5 flex-1 appearance-none overflow-hidden rounded-full"
            />
            <span className="text-muted-foreground text-xs tabular-nums">
              {count.toLocaleString('en')} / {goal.threshold.toLocaleString('en')}
            </span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function BadgesSkeleton() {
  return (
    <div className="bg-card space-y-3 rounded-xl border p-4" aria-hidden="true">
      <Skeleton className="h-5 w-32" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}
