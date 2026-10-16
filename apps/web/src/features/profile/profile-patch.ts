import type { UpdateProfileData, UpdateProfileInput, UserPrivate } from '@the-mesh/shared';

/** A new storage key, `null` to remove the current picture, `undefined` to leave it alone. */
export type ImageChange = string | null | undefined;

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
  if (images.avatar !== undefined) patch.avatarKey = images.avatar;
  if (images.cover !== undefined) patch.coverKey = images.cover;
  return Object.keys(patch).length > 0 ? patch : null;
}
