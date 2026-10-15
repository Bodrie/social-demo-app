import { z } from 'zod';

export const uuidSchema = z.uuid();

/** Optional free-text fields: trimmed, empty becomes null so there is one "unset" state. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .transform((value) => (value === '' ? null : value));
}
