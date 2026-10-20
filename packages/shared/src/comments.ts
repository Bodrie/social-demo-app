import { z } from 'zod';
import { uuidSchema } from './common.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { userSummarySchema } from './users.js';

export const COMMENT_MAX_LENGTH = 500;

// --- reactions --------------------------------------------------------------
/** Mirrors the database enum; one reaction per member and comment. */
export const REACTION_TYPES = ['LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD'] as const;
export const reactionTypeSchema = z.enum(REACTION_TYPES);
export type ReactionType = z.infer<typeof reactionTypeSchema>;

/** Display data for every reaction, in the order pickers show them. */
export const REACTIONS: ReadonlyArray<{ type: ReactionType; emoji: string; label: string }> = [
  { type: 'LIKE', emoji: '👍', label: 'Like' },
  { type: 'LOVE', emoji: '❤️', label: 'Love' },
  { type: 'LAUGH', emoji: '😂', label: 'Haha' },
  { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'SAD', emoji: '😢', label: 'Sad' },
];

/** Per-type counts (every type present, possibly 0), the total and the viewer's own reaction. */
export const reactionSummarySchema = z.object({
  counts: z.record(reactionTypeSchema, z.int().nonnegative()),
  total: z.int().nonnegative(),
  mine: reactionTypeSchema.nullable(),
});
export type ReactionSummary = z.infer<typeof reactionSummarySchema>;

export const setReactionSchema = z.object({ type: reactionTypeSchema });
export type SetReactionInput = z.infer<typeof setReactionSchema>;

// --- revisions ----------------------------------------------------------------
/** A previous version of a post or comment; `editedAt` is when it was replaced. */
export const revisionSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  editedAt: z.iso.datetime(),
});
export type Revision = z.infer<typeof revisionSchema>;
export const revisionListSchema = paginatedSchema(revisionSchema);
export type RevisionList = z.infer<typeof revisionListSchema>;

// --- comments ------------------------------------------------------------------
/**
 * Replies are comments one level down (C2): `parentId` names the top-level comment they sit
 * under, `replyCount` is how many a top-level comment has (always 0 on a reply). The post's
 * `commentCount` counts both.
 */
export const commentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  parentId: z.uuid().nullable(),
  content: z.string(),
  author: userSummarySchema,
  /** Null until the first edit. */
  editedAt: z.iso.datetime().nullable(),
  reactions: reactionSummarySchema,
  /** Members the text mentions (`@username`), resolved when the comment was saved or edited. */
  mentions: z.array(userSummarySchema),
  replyCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Comment = z.infer<typeof commentSchema>;

export const commentListSchema = paginatedSchema(commentSchema);
export type CommentList = z.infer<typeof commentListSchema>;

const commentContentSchema = z
  .string()
  .trim()
  .min(1, 'Write something first')
  .max(COMMENT_MAX_LENGTH, `At most ${COMMENT_MAX_LENGTH} characters`);

/** `parentId` makes it a reply to that comment (a reply to a reply lands under the same parent). */
export const createCommentSchema = z.object({
  content: commentContentSchema,
  parentId: uuidSchema.optional(),
});
export type CreateCommentInput = z.input<typeof createCommentSchema>;
export type CreateCommentData = z.output<typeof createCommentSchema>;

export const updateCommentSchema = z.object({ content: commentContentSchema });
export type UpdateCommentInput = z.input<typeof updateCommentSchema>;
export type UpdateCommentData = z.output<typeof updateCommentSchema>;

/** Replies read like a thread: oldest first, no sort options. */
export const repliesQuerySchema = cursorQuerySchema;
export type RepliesQuery = z.output<typeof repliesQuerySchema>;

export const COMMENT_SORTS = ['newest', 'top'] as const;
export const commentSortSchema = z.enum(COMMENT_SORTS);
export type CommentSort = z.infer<typeof commentSortSchema>;

/** `top` = most reactions first (ties: newest first). */
export const commentsQuerySchema = cursorQuerySchema.extend({
  sort: commentSortSchema.default('newest'),
});
export type CommentsQuery = z.output<typeof commentsQuerySchema>;
