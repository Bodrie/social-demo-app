import {
  ACHIEVEMENT_BY_KEY,
  type AchievementDefinition,
  achievementName,
} from '@beso/shared/achievements';
import { cn } from 'cn';
import { Link } from 'react-router';
import { Medallion } from './medallion';

/** A badge as a card: its medallion, name and what earns it. */
export function BadgeCard({
  achievement,
  className,
}: {
  achievement: AchievementDefinition;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border p-3', className)}>
      <Medallion achievement={achievement} size="lg" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{achievementName(achievement)}</p>
        <p className="text-muted-foreground">{achievement.description}</p>
      </div>
    </div>
  );
}

/**
 * The badge a post shares (ADR 0021, "Rewards"), leading to its author's Badges tab. A lazy
 * chunk of the card, so the catalogue stays off the feed's first paint; an unknown key (a
 * badge renamed since) shows nothing.
 */
export function PostBadge({
  achievementKey,
  username,
  className,
}: {
  achievementKey: string;
  username: string;
  className?: string;
}) {
  const achievement = ACHIEVEMENT_BY_KEY.get(achievementKey);
  if (!achievement) return null;
  return (
    <Link
      to={`/u/${username}/badges`}
      className={cn(
        'hover:bg-accent/40 focus-visible:ring-ring/50 block rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      <span className="sr-only">Badge: </span>
      <BadgeCard achievement={achievement} />
    </Link>
  );
}
