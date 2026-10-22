import { z } from 'zod';
import { excerptSchema } from './activities.js';
import { cursorQuerySchema, paginatedSchema } from './pagination.js';
import { userSummarySchema } from './users.js';

/** Mirrors the database enum. Chat has its own unread counts and stays out (ADR 0015). */
export const NOTIFICATION_TYPES = [
  'POST_LIKED',
  'POST_COMMENTED',
  /** `comment` is the reply to your comment (C2). */
  'COMMENT_REPLIED',
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

/**
 * How each notification reads after the actor's name, and which excerpt it quotes. The web
 * renders these words with links (`NotificationText`), a push notification as plain text
 * (`notificationPush`): a new type is one entry here.
 */
export const NOTIFICATION_PHRASES: Record<
  NotificationType,
  { phrase: string; quotes: 'post' | 'comment' | null }
> = {
  POST_LIKED: { phrase: 'liked your post', quotes: 'post' },
  POST_COMMENTED: { phrase: 'commented on your post', quotes: 'comment' },
  COMMENT_REPLIED: { phrase: 'replied to your comment', quotes: 'comment' },
  COMMENT_REACTED: { phrase: 'reacted to your comment', quotes: 'comment' },
  USER_FOLLOWED: { phrase: 'started following you', quotes: null },
  MENTIONED_IN_POST: { phrase: 'mentioned you in a post', quotes: 'post' },
  MENTIONED_IN_COMMENT: { phrase: 'mentioned you in a comment', quotes: 'comment' },
  POST_REPOSTED: { phrase: 'reposted your post', quotes: 'post' },
  POST_QUOTED: { phrase: 'quoted your post', quotes: 'post' },
};

/** Where a notification leads: the post (at the comment, for comment types) or the actor. */
export function notificationLink(notification: Notification): string {
  const { post, comment } = notification;
  if (post && comment) return `/p/${post.id}?comment=${comment.id}`;
  if (post) return `/p/${post.id}`;
  return `/u/${notification.actor.username}`;
}

export const notificationListSchema = paginatedSchema(notificationSchema);
export type NotificationList = z.infer<typeof notificationListSchema>;

export const notificationsQuerySchema = cursorQuerySchema;

export const unreadCountSchema = z.object({ count: z.number().int().nonnegative() });
export type UnreadCount = z.infer<typeof unreadCountSchema>;
