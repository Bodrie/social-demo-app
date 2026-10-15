import { z } from 'zod';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { uploadKeySchema } from './uploads.js';

export const POST_MAX_LENGTH = 500;

export const postAuthorSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
export type PostAuthor = z.infer<typeof postAuthorSchema>;

export const postSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  imageUrl: z.string().nullable(),
  author: postAuthorSchema,
  likeCount: z.int().nonnegative(),
  commentCount: z.int().nonnegative(),
  /** Whether the requesting user has liked this post. */
  likedByMe: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Post = z.infer<typeof postSchema>;

export const postListSchema = paginatedSchema(postSchema);
export type PostList = z.infer<typeof postListSchema>;

/** Only uploads made with `?kind=post` may be attached to a post. */
export const postImageKeySchema = uploadKeySchema.refine((key) => key.startsWith('post/'), {
  message: 'Use an upload of kind "post"',
});

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

export const feedQuerySchema = cursorQuerySchema;
export type FeedQuery = z.output<typeof feedQuerySchema>;
