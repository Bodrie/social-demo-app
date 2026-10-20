import { z } from 'zod';
import { excerptSchema } from './activities.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { userSummarySchema } from './users.js';

/** Mirrors the database enum. Chat has its own unread counts and stays out (ADR 0015). */
export const NOTIFICATION_TYPES = [
  'POST_LIKED',
  'POST_COMMENTED',
  'COMMENT_REACTED',
  'USER_FOLLOWED',
  'MENTIONED_IN_POST',
  'MENTIONED_IN_COMMENT',
  /** `post` is your post that was reposted. */
  'POST_REPOSTED',
  /** `post` is the quote (its excerpt is the quoter's words); it leads to the quote's page. */
  'POST_QUOTED',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * Something that happened to the viewer's own things. `post` is set for everything but a
 * follow; `comment` for the comment types; `readAt` once the viewer has seen it.
 */
export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  actor: userSummarySchema,
  post: excerptSchema.nullable(),
  comment: excerptSchema.nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListSchema = paginatedSchema(notificationSchema);
export type NotificationList = z.infer<typeof notificationListSchema>;

export const notificationsQuerySchema = cursorQuerySchema;

export const unreadCountSchema = z.object({ count: z.number().int().nonnegative() });
export type UnreadCount = z.infer<typeof unreadCountSchema>;
