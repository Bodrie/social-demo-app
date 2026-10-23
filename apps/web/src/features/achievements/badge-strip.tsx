import { ACHIEVEMENT_BY_KEY, achievementName } from '@beso/shared/achievements';
import { Link } from 'react-router';
import { rarest } from './badge-tiles';
import { Medallion } from './medallion';
import { useAchievementStats, useUserAchievements } from './use-achievements';

const SHOWN = 3;

type BadgeStripProps = {
  userId: string;
  /** The member's own choice (ADR 0021, "Rewards"); without one, the three rarest show. */
  featured: readonly string[];
};

/** The profile header's featured or three rarest badges, leading to the Badges tab. */
export function BadgeStrip({ userId, featured }: BadgeStripProps) {
  const query = useUserAchievements(userId);
  const stats = useAchievementStats();
  const items = query.data?.items ?? [];
  if (items.length === 0) return null;
  const held = new Set(items.map((item) => item.key));
  const chosen = featured.flatMap((key) => {
    const definition = held.has(key) ? ACHIEVEMENT_BY_KEY.get(key) : undefined;
    return definition ? [definition] : [];
  });
  const top = chosen.length > 0 ? chosen : rarest(items, stats.data, SHOWN, ACHIEVEMENT_BY_KEY);
  const count = `${items.length} ${items.length === 1 ? 'badge' : 'badges'}`;
  return (
    <Link
      to="badges"
      aria-label={`${count}, ${chosen.length > 0 ? 'featured' : 'the rarest'}: ${top.map(achievementName).join(', ')}`}
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
