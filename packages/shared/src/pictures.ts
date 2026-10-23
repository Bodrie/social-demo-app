/**
 * Ready-made profile pictures (ADR 0021, "Rewards"): avatars and covers a member picks instead
 * of uploading a photo, some of them unlocked by holding a badge. The files are
 * `apps/api/presets/<kind>-<id>.webp` (`pnpm presets`), which the API serves under
 * `/uploads/preset/`. Published as the entry `@beso/shared/pictures`, like the badges, so only
 * the screens that offer them load the list; nothing here imports the main entry.
 */

export const PRESET_KINDS = ['avatar', 'cover'] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

export type PresetPicture = {
  id: string;
  kind: PresetKind;
  /** What it shows, as its option is read out. */
  label: string;
  /** The badge that unlocks it; null for the pictures everyone may use. */
  unlockedBy: string | null;
};

const avatar = (id: string, label: string, unlockedBy: string | null = null): PresetPicture => ({
  id,
  kind: 'avatar',
  label,
  unlockedBy,
});
const cover = (id: string, label: string, unlockedBy: string | null = null): PresetPicture => ({
  id,
  kind: 'cover',
  label,
  unlockedBy,
});

export const AVATAR_PRESETS: readonly PresetPicture[] = [
  avatar('sunny', 'Long dark hair, smiling'),
  avatar('kai', 'Short hair, a big grin'),
  avatar('nora', 'A bun with a yellow bow'),
  avatar('zola', 'An afro and a wide smile'),
  avatar('amira', 'A hijab and a calm smile'),
  avatar('leo', 'A quiff and round glasses'),
  avatar('maya', 'Bantu knots and heart eyes'),
  avatar('theo', 'Bald with a full beard'),
  avatar('ivy', 'Big curls, wide-eyed'),
  avatar('omar', 'Short hair and a goatee'),
  avatar('grace', 'Grey hair and glasses'),
  avatar('remi', 'Twists, calm'),
  avatar('lea', 'A bob with bangs'),
  avatar('ravi', 'A turban and a beard'),
  avatar('juno', 'Space buns, cheeky'),
  avatar('sam', 'Medium hair and glasses'),
  // Earned
  avatar('shades', 'A hat and sunglasses', 'top-post-likes-10'),
  avatar('beanie', 'A green beanie', 'comments-10'),
  avatar('punk', 'A pink mohawk', 'tags-5'),
  avatar('elder', 'A grey bun and glasses', 'member-1m'),
  avatar('bear', 'A bear hat', 'crew'),
  avatar('dj', 'Dreads and shades', 'messages-100'),
  avatar('scholar', 'A flat-top and glasses', 'posts-50'),
  avatar('star', 'A big afro and heart eyes', 'followers-10'),
];

export const COVER_PRESETS: readonly PresetPicture[] = [
  cover('dawn', 'Hills at dawn'),
  cover('ocean', 'Ocean waves'),
  cover('meadow', 'A green meadow'),
  cover('mesh', 'Northern lights'),
  cover('paper', 'Dotted paper'),
  cover('citrus', 'Citrus stripes'),
  // Earned
  cover('night-sky', 'A night sky with a moon', 'night-owl'),
  cover('sunrise', 'A sunrise', 'early-bird'),
  cover('darkroom', 'A film strip', 'pictures-10'),
  cover('confetti', 'Confetti', 'collected-25'),
  cover('topography', 'A contour map', 'tags-20'),
  cover('gold', 'Gold with sparkles', 'collected-50'),
];

export const PRESETS: readonly PresetPicture[] = [...AVATAR_PRESETS, ...COVER_PRESETS];

export function findPreset(kind: PresetKind, id: string): PresetPicture | undefined {
  return PRESETS.find((preset) => preset.kind === kind && preset.id === id);
}

/** The file under `/uploads/preset/`. */
export const presetFile = (kind: PresetKind, id: string): string => `${kind}-${id}.webp`;

/** Whether a member holding the badges `earned` may pick it. */
export const presetUnlocked = (preset: PresetPicture, earned: ReadonlySet<string>): boolean =>
  preset.unlockedBy === null || earned.has(preset.unlockedBy);
