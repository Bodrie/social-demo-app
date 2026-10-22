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
  /** The actor registered through your invite link and now follows you (F1). */
  'INVITE_JOINED',
  /** The member earned the badge `achievementKey` (F2); the one type without an actor. */
  'ACHIEVEMENT_EARNED',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * Something that happened to the viewer's own things. `actor` is null for an earned badge
 * only; `post` is set for everything but a follow, an invite and a badge; `comment` for the
 * comment types; `achievementKey` for a badge; `readAt` once the viewer has seen it.
 */
export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  actor: userSummarySchema.nullable(),
  achievementKey: z.string().nullable(),
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
  INVITE_JOINED: { phrase: 'accepted your invite and follows you', quotes: null },
  /** Has no actor: the web names the badge (`achievementSentence`, `@beso/shared/achievements`). */
  ACHIEVEMENT_EARNED: { phrase: 'You earned a badge', quotes: null },
};

/**
 * Where a notification leads: the post (at the comment, for comment types), the actor, or the
 * member's own badges (`/badges` redirects to the profile tab).
 */
export function notificationLink(notification: Notification): string {
  const { post, comment, actor } = notification;
  if (post && comment) return `/p/${post.id}?comment=${comment.id}`;
  if (post) return `/p/${post.id}`;
  if (actor) return `/u/${actor.username}`;
  return '/badges';
}

export const notificationListSchema = paginatedSchema(notificationSchema);
export type NotificationList = z.infer<typeof notificationListSchema>;

export const notificationsQuerySchema = cursorQuerySchema;

export const unreadCountSchema = z.object({ count: z.number().int().nonnegative() });
export type UnreadCount = z.infer<typeof unreadCountSchema>;
