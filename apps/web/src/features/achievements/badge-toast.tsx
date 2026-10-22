import { ACHIEVEMENT_BY_KEY, achievementSentence } from '@beso/shared/achievements';
import { toast } from 'sonner';
import { Medallion } from './medallion';

/** The toast for a badge that arrives while the app is open (F2); loaded when one does. */
export function showBadgeToast(key: string | null, openBadges: () => void): void {
  const achievement = key === null ? undefined : ACHIEVEMENT_BY_KEY.get(key);
  if (!achievement) return;
  toast(achievementSentence(key), {
    id: `badge:${achievement.key}`,
    description: achievement.description,
    icon: <Medallion achievement={achievement} size="sm" />,
    action: { label: 'See badges', onClick: openBadges },
  });
}
