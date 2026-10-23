import { ACHIEVEMENT_BY_KEY, achievementSentence } from '@beso/shared/achievements';
import { toast } from 'sonner';
import { celebrate } from './confetti';
import { Medallion } from './medallion';

/**
 * The toast for a badge that arrives while the app is open (F2), with confetti and "Share"
 * (ADR 0021, "Rewards"); loaded when one does.
 */
export function showBadgeToast(
  key: string | null,
  openBadges: () => void,
  share: (key: string) => void,
): void {
  const achievement = key === null ? undefined : ACHIEVEMENT_BY_KEY.get(key);
  if (!achievement) return;
  celebrate();
  toast(achievementSentence(key), {
    id: `badge:${achievement.key}`,
    description: achievement.description,
    icon: <Medallion achievement={achievement} size="sm" />,
    // sonner's icon slot is 16 px and does not grow with its content, so the medallion would
    // spill over the text; its rule outranks a plain utility, hence the `!`.
    classNames: { icon: 'size-8!' },
    action: { label: 'Share', onClick: () => share(achievement.key) },
    cancel: { label: 'See badges', onClick: openBadges },
  });
}
