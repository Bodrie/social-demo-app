import { ACHIEVEMENT_BY_KEY, achievementName } from '@beso/shared/achievements';
import { Link } from 'react-router';
import { rarest } from './badge-tiles';
import { Medallion } from './medallion';
import { useAchievementStats, useUserAchievements } from './use-achievements';

const SHOWN = 3;

/** The profile header's three rarest badges, leading to the Badges tab. Nothing when none. */
export function BadgeStrip({ userId }: { userId: string }) {
  const query = useUserAchievements(userId);
  const stats = useAchievementStats();
  const items = query.data?.items ?? [];
  if (items.length === 0) return null;
  const top = rarest(items, stats.data, SHOWN, ACHIEVEMENT_BY_KEY);
  const count = `${items.length} ${items.length === 1 ? 'badge' : 'badges'}`;
  return (
    <Link
      to="badges"
      aria-label={`${count}, the rarest: ${top.map(achievementName).join(', ')}`}
      className="hover:bg-accent mt-3 inline-flex items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-sm"
    >
      <span className="flex -space-x-2">
        {top.map((achievement) => (
          <Medallion
            key={achievement.key}
            achievement={achievement}
            size="sm"
            className="ring-card ring-2"
          />
        ))}
      </span>
      <span className="text-muted-foreground">{count}</span>
    </Link>
  );
}
