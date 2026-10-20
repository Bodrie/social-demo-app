import { z } from 'zod';
import { uuidSchema } from './common.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { postImageKeySchema } from './uploads.js';
import { userSummarySchema } from './users.js';

export const POST_MAX_LENGTH = 500;

/**
 * The original inside a quote post, one level deep (quoting a quote shows its text, not its
 * own embed), or the frame left once the original was deleted (ADR 0017).
 */
export const postEmbedSchema = z.union([
  z.object({ unavailable: z.literal(true) }),
  z.object({
    id: z.uuid(),
    author: userSummarySchema,
    content: z.string(),
    imageUrl: z.string().nullable(),
    createdAt: z.iso.datetime(),
  }),
]);
export type PostEmbed = z.infer<typeof postEmbedSchema>;
export type AvailableEmbed = Extract<PostEmbed, { id: string }>;
export const isAvailableEmbed = (embed: PostEmbed): embed is AvailableEmbed =>
  !('unavailable' in embed);

export const postSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  imageUrl: z.string().nullable(),
  author: userSummarySchema,
  likeCount: z.int().nonnegative(),
  commentCount: z.int().nonnegative(),
  /** Whether the requesting user has liked this post. */
  likedByMe: z.boolean(),
  /** The viewer's private save-for-later; nobody else's are counted or shown (C3a). */
  bookmarkedByMe: z.boolean(),
  /** Plain reposts and quotes of this post together (ADR 0017). */
  repostCount: z.int().nonnegative(),
  /** Whether the viewer has a plain repost of it; quotes are posts of their own and not toggles. */
  repostedByMe: z.boolean(),
  /** Set on a quote post: the original, or `{ unavailable: true }` once that is gone. */
  quotedPost: postEmbedSchema.nullable(),
  /** On feed and profile items only: who reposted it and when; null when the item is the post itself. */
  repost: z.object({ by: userSummarySchema, at: z.iso.datetime() }).nullable(),
  /** Null until the first edit. */
  editedAt: z.iso.datetime().nullable(),
  /** Members the text mentions (`@username`), resolved when the post was saved or edited. */
  mentions: z.array(userSummarySchema),
  /** Lower-cased tags in the text, alphabetically. */
  hashtags: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Post = z.infer<typeof postSchema>;

export const postListSchema = paginatedSchema(postSchema);
export type PostList = z.infer<typeof postListSchema>;

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write something first')
    .max(POST_MAX_LENGTH, `At most ${POST_MAX_LENGTH} characters`),
  imageKey: postImageKeySchema.optional(),
  /** Makes the post a quote of that post; a plain repost (no text) is `PUT /posts/:id/repost` instead. */
  quotedPostId: uuidSchema.optional(),
});
export type CreatePostInput = z.input<typeof createPostSchema>;
export type CreatePostData = z.output<typeof createPostSchema>;

/** Only the text can change; the picture is fixed once posted. */
export const updatePostSchema = createPostSchema.pick({ content: true });
export type UpdatePostInput = z.input<typeof updatePostSchema>;
export type UpdatePostData = z.output<typeof updatePostSchema>;

export const feedQuerySchema = cursorQuerySchema;
export type FeedQuery = z.output<typeof feedQuerySchema>;

/** `GET /users/:id/posts`: with the member's plain reposts (the profile's default) or the posts alone. */
export const userPostsQuerySchema = cursorQuerySchema.extend({
  include: z.enum(['reposts', 'own']).default('reposts'),
});
export type UserPostsQuery = z.output<typeof userPostsQuerySchema>;

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** `GET /search/posts`: full-text search over post content (`websearch_to_tsquery` syntax). */
export const searchQuerySchema = cursorQuerySchema.extend({
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `At least ${SEARCH_MIN_LENGTH} characters`)
    .max(SEARCH_MAX_LENGTH, `At most ${SEARCH_MAX_LENGTH} characters`),
});
export type SearchQuery = z.output<typeof searchQuerySchema>;
