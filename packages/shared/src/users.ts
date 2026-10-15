import { z } from 'zod';
import { paginatedSchema } from './pagination.js';

export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

// --- input building blocks (normalise, then validate) --------------------
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters')
  .max(30, 'At most 30 characters')
  .regex(USERNAME_PATTERN, 'Only lowercase letters, digits and underscores');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'At most 254 characters')
  .pipe(z.email('Enter a valid email address'));

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(80, 'At most 80 characters');
export const bioSchema = z.string().trim().max(300, 'At most 300 characters');
export const citySchema = z.string().trim().max(80, 'At most 80 characters');
export const websiteSchema = z.url('Enter a valid URL').max(200, 'At most 200 characters');

// --- outputs ------------------------------------------------------------
export const userCountsSchema = z.object({
  posts: z.int().nonnegative(),
  followers: z.int().nonnegative(),
  following: z.int().nonnegative(),
});

/** What anyone may see about a user. */
export const userPublicSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  website: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
  counts: userCountsSchema,
});
export type UserPublic = z.infer<typeof userPublicSchema>;

/** The user's own profile (adds private fields). */
export const userPrivateSchema = userPublicSchema.extend({
  email: z.string(),
  updatedAt: z.iso.datetime(),
});
export type UserPrivate = z.infer<typeof userPrivateSchema>;

export const userListSchema = paginatedSchema(userPublicSchema);
export type UserList = z.infer<typeof userListSchema>;

// --- inputs -------------------------------------------------------------
export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  bio: bioSchema.nullable().optional(),
  city: citySchema.nullable().optional(),
  website: websiteSchema.nullable().optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;

export const suggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});
export type SuggestionsQuery = z.output<typeof suggestionsQuerySchema>;
