import type { UpdateProfileData, UpdateProfileInput, UserPrivate } from '@beso/shared';

/**
 * A new upload (its storage key), a ready-made picture (its id), `null` to have none (the
 * initials, no cover), `undefined` to leave the picture alone.
 */
export type ImageChange = { key: string } | { preset: string } | null | undefined;

const TEXT_FIELDS = ['name', 'username'] as const;
const OPTIONAL_FIELDS = ['bio', 'city', 'website'] as const;

/** Only what actually changed goes to PATCH /users/me; null when nothing did. */
export function buildProfilePatch(
  current: UserPrivate,
  values: UpdateProfileData,
  images: { avatar: ImageChange; cover: ImageChange },
): UpdateProfileInput | null {
  const patch: UpdateProfileInput = {};
  for (const field of TEXT_FIELDS) {
    const next = values[field];
    if (next !== undefined && next !== current[field]) patch[field] = next;
  }
  for (const field of OPTIONAL_FIELDS) {
    const next = values[field];
    if (next !== undefined && next !== current[field]) patch[field] = next;
  }
  const picture = (
    change: ImageChange,
    key: 'avatarKey' | 'coverKey',
    preset: 'avatarPreset' | 'coverPreset',
  ) => {
    if (change === undefined) return;
    if (change === null) {
      patch[key] = null;
      patch[preset] = null;
    } else if ('key' in change) patch[key] = change.key;
    else patch[preset] = change.preset;
  };
  picture(images.avatar, 'avatarKey', 'avatarPreset');
  picture(images.cover, 'coverKey', 'coverPreset');
  return Object.keys(patch).length > 0 ? patch : null;
}
