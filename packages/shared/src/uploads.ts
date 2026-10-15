import { z } from 'zod';

export const UPLOAD_KINDS = ['avatar', 'cover', 'post'] as const;
export const uploadKindSchema = z.enum(UPLOAD_KINDS);
export type UploadKind = z.infer<typeof uploadKindSchema>;

/** Storage keys are `<kind>/<uuid>.webp`; every upload is re-encoded to WebP. */
export const UPLOAD_KEY_PATTERN =
  /^(avatar|cover|post)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
export const uploadKeySchema = z.string().regex(UPLOAD_KEY_PATTERN, 'Invalid upload key');

const keyOfKind = (kind: UploadKind) =>
  uploadKeySchema.refine((key) => key.startsWith(`${kind}/`), {
    message: `Use an upload of kind "${kind}"`,
  });

/** Each use site only accepts keys produced with the matching `?kind=`. */
export const avatarKeySchema = keyOfKind('avatar');
export const coverKeySchema = keyOfKind('cover');
export const postImageKeySchema = keyOfKind('post');

export const uploadQuerySchema = z.object({ kind: uploadKindSchema });

export const uploadResponseSchema = z.object({
  key: uploadKeySchema,
  url: z.url(),
  width: z.int().positive(),
  height: z.int().positive(),
  bytes: z.int().positive(),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;

/** Mirrors the API defaults so forms can validate before uploading. */
export const UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
} as const;
