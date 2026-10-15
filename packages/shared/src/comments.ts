import { z } from 'zod';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { userSummarySchema } from './users.js';

export const COMMENT_MAX_LENGTH = 500;

export const commentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  content: z.string(),
  author: userSummarySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Comment = z.infer<typeof commentSchema>;

export const commentListSchema = paginatedSchema(commentSchema);
export type CommentList = z.infer<typeof commentListSchema>;

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write something first')
    .max(COMMENT_MAX_LENGTH, `At most ${COMMENT_MAX_LENGTH} characters`),
});
export type CreateCommentInput = z.input<typeof createCommentSchema>;
export type CreateCommentData = z.output<typeof createCommentSchema>;

export const commentsQuerySchema = cursorQuerySchema;
