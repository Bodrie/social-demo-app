import { z } from 'zod';
import { reactionTypeSchema } from './comments.js';
import { UPLOAD_KINDS } from './uploads.js';
import { userPrivateSchema } from './users.js';

/** `DELETE /users/me`: the password confirms it is the owner asking. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(128),
});
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
export type DeleteAccountData = z.output<typeof deleteAccountSchema>;

const revisionEntrySchema = z.object({ content: z.string(), editedAt: z.iso.datetime() });
const followEntrySchema = z.object({
  userId: z.uuid(),
  username: z.string(),
  since: z.iso.datetime(),
});

/**
 * `GET /users/me/export`: everything the account holds, as JSON. Pictures are referenced by
 * URL (they are public files); other people's content is not included, only the member's
 * own words and actions.
 */
export const accountExportSchema = z.object({
  exportedAt: z.iso.datetime(),
  user: userPrivateSchema,
  posts: z.array(
    z.object({
      id: z.uuid(),
      content: z.string(),
      imageUrl: z.string().nullable(),
      hashtags: z.array(z.string()),
      createdAt: z.iso.datetime(),
      editedAt: z.iso.datetime().nullable(),
      revisions: z.array(revisionEntrySchema),
    }),
  ),
  comments: z.array(
    z.object({
      id: z.uuid(),
      postId: z.uuid(),
      parentId: z.uuid().nullable(),
      content: z.string(),
      createdAt: z.iso.datetime(),
      editedAt: z.iso.datetime().nullable(),
      revisions: z.array(revisionEntrySchema),
    }),
  ),
  likes: z.array(z.object({ postId: z.uuid(), createdAt: z.iso.datetime() })),
  bookmarks: z.array(z.object({ postId: z.uuid(), createdAt: z.iso.datetime() })),
  /** Plain reposts; quotes are among `posts`. */
  reposts: z.array(z.object({ postId: z.uuid(), createdAt: z.iso.datetime() })),
  reactions: z.array(
    z.object({ commentId: z.uuid(), type: reactionTypeSchema, createdAt: z.iso.datetime() }),
  ),
  following: z.array(followEntrySchema),
  followers: z.array(followEntrySchema),
  messages: z.array(
    z.object({
      id: z.uuid(),
      conversationId: z.uuid(),
      conversationTitle: z.string().nullable(),
      content: z.string(),
      imageUrl: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  uploads: z.array(
    z.object({
      key: z.string(),
      kind: z.enum(UPLOAD_KINDS),
      url: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type AccountExport = z.infer<typeof accountExportSchema>;
