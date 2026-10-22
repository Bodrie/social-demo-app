import type { Notification } from './notifications.js';
import {
  PUSH_BODY_LENGTH,
  isPushServiceUrl,
  notificationPush,
  pushPayloadSchema,
  pushSubscriptionSchema,
} from './push.js';

const actor = {
  id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b1',
  username: 'bob',
  name: 'Bob Brown',
  avatarUrl: null,
};
const notification = (overrides: Partial<Notification>): Notification => ({
  id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b2',
  type: 'POST_LIKED',
  actor,
  post: { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b3', excerpt: 'Hello world' },
  comment: null,
  readAt: null,
  createdAt: '2026-10-22T10:00:00.000Z',
  ...overrides,
});

describe('isPushServiceUrl', () => {
  it('accepts the browsers’ push services and nothing else', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://web.push.apple.com/QOb2KJ',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(isPushServiceUrl(ok), ok).toBe(true);
    }
    for (const bad of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/fcm/send/abc',
      'https://user@fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com.evil.example/x',
      'https://notify.windows.com.evil.example/x',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/push',
      'not a url',
    ]) {
      expect(isPushServiceUrl(bad), bad).toBe(false);
    }
  });

  it('is what the subscription schema checks', () => {
    const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
    expect(
      pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys })
        .success,
    ).toBe(true);
    expect(
      pushSubscriptionSchema.safeParse({ endpoint: 'https://example.com/push', keys }).success,
    ).toBe(false);
  });
});

describe('notificationPush', () => {
  it('puts the actor in the title and the web’s words in the body, quoting the subject', () => {
    const push = notificationPush(notification({}));
    expect(pushPayloadSchema.parse(push)).toEqual({
      title: 'Bob Brown',
      body: 'Liked your post: “Hello world”',
      url: '/p/01a13ed6-d3ec-71cb-b39f-fbc256a293b3',
      tag: 'notification:01a13ed6-d3ec-71cb-b39f-fbc256a293b2',
      timestamp: Date.parse('2026-10-22T10:00:00.000Z'),
    });
  });

  it('quotes the comment for comment types and leads to it', () => {
    const push = notificationPush(
      notification({
        type: 'COMMENT_REPLIED',
        comment: { id: '01a13ed6-d3ec-71cb-b39f-fbc256a293b4', excerpt: 'Me too' },
      }),
    );
    expect(push.body).toBe('Replied to your comment: “Me too”');
    expect(push.url).toBe(
      '/p/01a13ed6-d3ec-71cb-b39f-fbc256a293b3?comment=01a13ed6-d3ec-71cb-b39f-fbc256a293b4',
    );
  });

  it('leads a follow to the follower and keeps long bodies short', () => {
    const follow = notificationPush(notification({ type: 'USER_FOLLOWED', post: null }));
    expect(follow).toMatchObject({ body: 'Started following you', url: '/u/bob' });

    const long = notificationPush(
      notification({ post: { id: actor.id, excerpt: 'x'.repeat(400) } }),
    );
    expect(long.body).toHaveLength(PUSH_BODY_LENGTH);
    expect(long.body.endsWith('…')).toBe(true);
  });
});
