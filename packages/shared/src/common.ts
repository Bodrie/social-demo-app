import { z } from 'zod';

/**
 * Ids coming from clients (params, bodies, socket payloads). Lower-cased so that keys built
 * from them as text (`direct_key`) and in-memory comparisons agree with what Postgres stores.
 */
export const uuidSchema = z.uuid().toLowerCase();

/** Optional free-text fields: trimmed, empty becomes null so there is one "unset" state. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .transform((value) => (value === '' ? null : value));
}
