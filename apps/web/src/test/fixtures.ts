import { emptyReactions } from '@/features/comments/reactions';
import type {
  Activity,
  ActivityType,
  Comment,
  Message,
  Notification,
  NotificationType,
  Post,
  UserPrivate,
  UserSummary,
} from '@the-mesh/shared';

export const TEST_PASSWORD = 'Password123!';

const BASE_TIME = Date.UTC(2026, 9, 15, 10, 0, 0);
let sequence = 0;

/** Deterministic, valid (v7-shaped) UUIDs so failures are readable. */
export function testId(
  kind: 'user' | 'post' | 'comment' | 'activity' | 'message' | 'conversation' | 'notification',
  n: number,
): string {
  const prefix = {
    user: '01a13e00',
    post: '01a13f00',
    comment: '01a14000',
    activity: '01a14100',
    message: '01a14200',
    conversation: '01a14300',
    notification: '01a14400',
  }[kind];
  return `${prefix}-0000-7000-8000-${String(n).padStart(12, '0')}`;
}

export function makeUser(overrides: Partial<UserPrivate> = {}): UserPrivate {
  return {
    id: testId('user', 1),
    username: 'alice',
    name: 'Alice Anderson',
    avatarUrl: null,
    bio: null,
    city: 'Sofia',
    website: null,
    coverUrl: null,
    createdAt: '2026-10-15T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z',
    counts: { posts: 0, followers: 0, following: 0 },
    followedByMe: false,
    followsMe: false,
    email: 'alice@example.com',
    emailVerifiedAt: '2026-10-15T10:05:00.000Z',
    settings: { chatBubbles: true, messageSound: false, browserNotifications: false },
    ...overrides,
  };
}

export const alice = makeUser();
export const bob = makeUser({
  id: testId('user', 2),
  username: 'bob',
  name: 'Bob Brown',
  email: 'bob@example.com',
  city: 'Plovdiv',
  bio: 'Builds things.',
});
export const carol = makeUser({
  id: testId('user', 3),
  username: 'carol',
  name: 'Carol Clark',
  email: 'carol@example.com',
  city: 'Varna',
});

export function summaryOf(user: UserPrivate): UserSummary {
  return { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl };
}

/** Each call is one minute older than the previous one, so lists sort newest-first. */
export function makePost(overrides: Partial<Post> = {}): Post {
  sequence += 1;
  const createdAt = new Date(BASE_TIME - sequence * 60_000).toISOString();
  return {
    id: testId('post', sequence),
    content: `Post number ${sequence}`,
    imageUrl: null,
    author: summaryOf(bob),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    bookmarkedByMe: false,
    repostCount: 0,
    repostedByMe: false,
    quotedPost: null,
    repost: null,
    editedAt: null,
    mentions: [],
    hashtags: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

export function makeComment(postId: string, overrides: Partial<Comment> = {}): Comment {
  sequence += 1;
  const createdAt = new Date(BASE_TIME - sequence * 60_000).toISOString();
  return {
    id: testId('comment', sequence),
    postId,
    content: `Comment number ${sequence}`,
    author: summaryOf(bob),
    editedAt: null,
    reactions: emptyReactions(),
    mentions: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

export function makeActivity(type: ActivityType, overrides: Partial<Activity> = {}): Activity {
  sequence += 1;
  return {
    id: testId('activity', sequence),
    type,
    actor: summaryOf(bob),
    post: null,
    comment: null,
    targetUser: null,
    createdAt: new Date(BASE_TIME - sequence * 60_000).toISOString(),
    ...overrides,
  };
}

/** Each call is one minute older than the previous one, so a list reads newest first; unread by default. */
export function makeNotification(
  type: NotificationType,
  overrides: Partial<Notification> = {},
): Notification {
  sequence += 1;
  return {
    id: testId('notification', sequence),
    type,
    actor: summaryOf(bob),
    post: null,
    comment: null,
    readAt: null,
    createdAt: new Date(BASE_TIME - sequence * 60_000).toISOString(),
    ...overrides,
  };
}

/** Each call is one minute newer than the previous one, so threads read top to bottom. */
export function makeMessage(
  conversationId: string,
  senderId: string,
  content: string,
  overrides: Partial<Message> = {},
): Message {
  sequence += 1;
  return {
    id: testId('message', sequence),
    conversationId,
    senderId,
    kind: 'user',
    content,
    imageUrl: null,
    deletedAt: null,
    system: null,
    createdAt: new Date(BASE_TIME - 3_600_000 + sequence * 60_000).toISOString(),
    ...overrides,
  };
}

export function resetFixtureSequence(): void {
  sequence = 0;
}
