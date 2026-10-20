import { z } from 'zod';
import { optionalText } from './common.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { avatarKeySchema, coverKeySchema } from './uploads.js';

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
export const bioSchema = optionalText(300);
export const citySchema = optionalText(80);
/** http(s) only: a `javascript:` or `data:` URL must never reach an anchor tag. */
export const websiteSchema = optionalText(200).pipe(
  z
    .url({ protocol: /^https?$/, hostname: z.regexes.domain, error: 'Enter a valid http(s) URL' })
    .nullable(),
);

// --- outputs ------------------------------------------------------------
/** The compact user shape embedded in posts, comments, activities, messages and presence. */
export const userSummarySchema = z.object({
  id: z.uuid(),
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const userCountsSchema = z.object({
  posts: z.int().nonnegative(),
  followers: z.int().nonnegative(),
  following: z.int().nonnegative(),
});

/** What anyone may see about a user. */
export const userPublicSchema = userSummarySchema.extend({
  bio: z.string().nullable(),
  city: z.string().nullable(),
  website: z.string().nullable(),
  coverUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
  counts: userCountsSchema,
  /** The requesting user follows this user. */
  followedByMe: z.boolean(),
  /** This user follows the requesting user. */
  followsMe: z.boolean(),
  /**
   * The viewer blocked this user / this user blocked the viewer (ADR 0016). Either way the
   * profile comes reduced: no bio, picture, counts or follow flags, just who it is.
   */
  blocked: z.boolean(),
  blockedMe: z.boolean(),
  /** The viewer muted this user: their posts stay out of the viewer's feeds, nothing else changes. */
  muted: z.boolean(),
});
export type UserPublic = z.infer<typeof userPublicSchema>;

/**
 * Account-level preferences, stored as JSON on the user row. Unknown keys are dropped and
 * missing ones get their default, so the row can start empty and gain keys over time.
 */
export const userSettingsSchema = z.object({
  /** Floating chat bubbles for messages that arrive while the viewer is elsewhere (ADR 0009). */
  chatBubbles: z.boolean().default(true),
  messageSound: z.boolean().default(false),
  browserNotifications: z.boolean().default(false),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

/** `PATCH /users/me/settings`: any subset of the keys. */
export const updateSettingsSchema = z.object({
  chatBubbles: z.boolean().optional(),
  messageSound: z.boolean().optional(),
  browserNotifications: z.boolean().optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** The user's own profile (adds private fields). */
/** Admins read the reports queue and act on it (ADR 0016). */
export const USER_ROLES = ['member', 'admin'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userPrivateSchema = userPublicSchema.extend({
  email: z.string(),
  /** A new address waiting for its confirmation link (Settings → Email). */
  pendingEmail: z.string().nullable(),
  role: userRoleSchema,
  settings: userSettingsSchema,
  /** Null until the address was confirmed through the link we mailed; the app is closed until then. */
  emailVerifiedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});
export type UserPrivate = z.infer<typeof userPrivateSchema>;

/** Returned by every endpoint that yields the caller's own profile (auth + PATCH /users/me). */
export const meResponseSchema = z.object({ user: userPrivateSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;

export const userListSchema = paginatedSchema(userPublicSchema);
export type UserList = z.infer<typeof userListSchema>;

// --- inputs -------------------------------------------------------------
/**
 * No `email`: a new address has to be confirmed before it replaces the old one, and that flow
 * does not exist yet (ADR 0011). An `email` key is dropped like any unknown key.
 */
export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  name: nameSchema.optional(),
  bio: bioSchema.nullable().optional(),
  city: citySchema.nullable().optional(),
  website: websiteSchema.nullable().optional(),
  /** Keys returned by POST /uploads?kind=avatar|cover; null removes the picture. */
  avatarKey: avatarKeySchema.nullable().optional(),
  coverKey: coverKeySchema.nullable().optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;

export const USER_SEARCH_MAX_LENGTH = 80;
export const listUsersQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(USER_SEARCH_MAX_LENGTH).optional(),
});
export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;

export const suggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});
export type SuggestionsQuery = z.output<typeof suggestionsQuerySchema>;

export const followsQuerySchema = cursorQuerySchema;
