import { z } from 'zod';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { postImageKeySchema } from './uploads.js';
import { userSummarySchema } from './users.js';

export const POST_MAX_LENGTH = 500;

export const postSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  imageUrl: z.string().nullable(),
  author: userSummarySchema,
  likeCount: z.int().nonnegative(),
  commentCount: z.int().nonnegative(),
  /** Whether the requesting user has liked this post. */
  likedByMe: z.boolean(),
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
});
export type CreatePostInput = z.input<typeof createPostSchema>;
export type CreatePostData = z.output<typeof createPostSchema>;

/** Only the text can change; the picture is fixed once posted. */
export const updatePostSchema = createPostSchema.pick({ content: true });
export type UpdatePostInput = z.input<typeof updatePostSchema>;
export type UpdatePostData = z.output<typeof updatePostSchema>;

export const feedQuerySchema = cursorQuerySchema;
export type FeedQuery = z.output<typeof feedQuerySchema>;

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
