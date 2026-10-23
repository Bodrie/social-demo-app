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
  /** The member earned the badge `achievementKey` (F2); without an actor. */
  'ACHIEVEMENT_EARNED',
  /**
   * A poll closed (F3): to its voters with the poll's author as the actor, and to the author
   * without one (nobody is told about their own doing). `post` is the poll.
   */
  'POLL_ENDED',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * Something that happened to the viewer's own things. `actor` is null for an earned badge and
 * for the end of the member's own poll; `post` is set for everything but a follow, an invite
 * and a badge; `comment` for the comment types; `achievementKey` for a badge; `readAt` once
 * the viewer has seen it.
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
 * How each notification reads after the actor's name, and which excerpt it quotes; `own` is
 * the sentence when there is no actor because it is about the member's own doing. The web
 * renders these words with links (`NotificationText`), a push notification as plain text
 * (`notificationPush`): a new type is one entry here.
 */
export const NOTIFICATION_PHRASES: Record<
  NotificationType,
  { phrase: string; quotes: 'post' | 'comment' | null; own?: string }
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
  POLL_ENDED: {
    phrase: 'asked, and the results are in',
    quotes: 'post',
    own: 'The results of your poll are in',
  },
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
