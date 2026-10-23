import { ACHIEVEMENT_BY_KEY, achievementName } from '@beso/shared/achievements';
import { type PresetPicture, presetUnlocked } from '@beso/shared/pictures';

/**
 * Why a ready-made picture is still locked for a member holding `earned`: "Unlocks with
 * “Hit”", or no name for a badge that is still a secret; null once it is theirs.
 */
export function lockReason(earned: ReadonlySet<string>) {
  return (preset: PresetPicture): string | null => {
    if (presetUnlocked(preset, earned)) return null;
    const badge = preset.unlockedBy ? ACHIEVEMENT_BY_KEY.get(preset.unlockedBy) : undefined;
    if (!badge) return 'Locked';
    return badge.hidden
      ? 'Unlocks with a hidden badge'
      : `Unlocks with “${achievementName(badge)}”`;
  };
}
