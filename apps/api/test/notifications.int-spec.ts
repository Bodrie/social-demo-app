import {
  type Notification,
  commentSchema,
  notificationListSchema,
  postSchema,
  unreadCountSchema,
} from '@beso/shared';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import {
  TEST_PASSWORD,
  type CreatedUser,
  type TestAgent,
  cookiesFrom,
  createUser,
  holdEveryBadge,
} from './setup/factories.js';

/** Logs in and keeps the access token, which the socket handshake needs as a cookie header. */
async function sessionFor(
  t: TestApp,
  user: CreatedUser,
): Promise<{ agent: TestAgent; token: string }> {
  const agent = request.agent(t.server);
  const response = await agent
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD })
    .expect(200);
  return { agent, token: cookiesFrom(response.headers['set-cookie']).access_token ?? '' };
}

function connectAs(t: TestApp, token: string): Promise<Socket> {
  const socket = io(t.baseUrl, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
    extraHeaders: { cookie: `access_token=${token}` },
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
    socket.connect();
  });
}

const list = async (agent: TestAgent, query = ''): Promise<Notification[]> =>
  notificationListSchema.parse((await agent.get(`/api/v1/notifications${query}`).expect(200)).body)
    .items;
const unread = async (agent: TestAgent): Promise<number> =>
  unreadCountSchema.parse((await agent.get('/api/v1/notifications/unread-count').expect(200)).body)
    .count;
const createPost = async (agent: TestAgent, content: string) =>
  postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body);
const comment = async (agent: TestAgent, postId: string, content: string) =>
  commentSchema.parse(
    (await agent.post(`/api/v1/posts/${postId}/comments`).send({ content }).expect(201)).body,
  );

describe('notifications', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let carol: CreatedUser;
  let aliceToken: string;
  let carolToken: string;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;
  let carolAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
    alice = await createUser(t.prisma, { username: 'alice' });
    bob = await createUser(t.prisma, { username: 'bob' });
    carol = await createUser(t.prisma, { username: 'carol' });
    // Badges have their own tests (achievements.int-spec.ts).
    await holdEveryBadge(t.prisma, alice, bob, carol);
    ({ agent: aliceAgent, token: aliceToken } = await sessionFor(t, alice));
    ({ agent: bobAgent } = await sessionFor(t, bob));
    ({ agent: carolAgent, token: carolToken } = await sessionFor(t, carol));
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('tells a member what others did to their things, never about their own doing', async () => {
    const post = await createPost(aliceAgent, 'A post by alice');
    await aliceAgent.put(`/api/v1/posts/${post.id}/like`).expect(204);
    await bobAgent.put(`/api/v1/posts/${post.id}/like`).expect(204);
    const bobsComment = await comment(bobAgent, post.id, 'Bob comments');
    await aliceAgent.put(`/api/v1/comments/${bobsComment.id}/reaction`).send({ type: 'LOVE' });
    await bobAgent.put(`/api/v1/users/${alice.id}/follow`).expect(204);
    await createPost(bobAgent, 'Hey @alice look');
    await comment(aliceAgent, post.id, 'Thanks @bob');

    const mine = await list(aliceAgent);
    expect(mine.map((n) => [n.type, n.actor?.username])).toEqual([
      ['MENTIONED_IN_POST', 'bob'],
      ['USER_FOLLOWED', 'bob'],
      ['POST_COMMENTED', 'bob'],
      ['POST_LIKED', 'bob'],
    ]);
    expect(mine[3]).toMatchObject({
      post: { id: post.id, excerpt: 'A post by alice' },
      comment: null,
      readAt: null,
    });
    expect(mine[2]).toMatchObject({
      post: { id: post.id },
      comment: { id: bobsComment.id, excerpt: 'Bob comments' },
    });
    expect(await unread(aliceAgent)).toBe(4);

    const bobs = await list(bobAgent);
    expect(bobs.map((n) => [n.type, n.actor?.username])).toEqual([
      ['MENTIONED_IN_COMMENT', 'alice'],
      ['COMMENT_REACTED', 'alice'],
    ]);
    expect(bobs[1]).toMatchObject({ post: { id: post.id }, comment: { id: bobsComment.id } });
    expect(await list(carolAgent)).toEqual([]);
  });

  it('keeps one row per event: a repeat refreshes it, an undo removes it', async () => {
    const post = await createPost(aliceAgent, 'Counting rows');
    const bobsComment = await comment(bobAgent, post.id, 'One comment');
    await aliceAgent.put(`/api/v1/comments/${bobsComment.id}/reaction`).send({ type: 'LIKE' });
    await bobAgent.post('/api/v1/notifications/read').expect(204);
    // Switching the emoji is not a new reaction; removing and putting it back is.
    await aliceAgent.put(`/api/v1/comments/${bobsComment.id}/reaction`).send({ type: 'WOW' });
    expect(await unread(bobAgent)).toBe(0);
    await aliceAgent.delete(`/api/v1/comments/${bobsComment.id}/reaction`).expect(200);
    await aliceAgent.put(`/api/v1/comments/${bobsComment.id}/reaction`).send({ type: 'LOVE' });
    const reacted = (await list(bobAgent)).filter(
      (n) => n.type === 'COMMENT_REACTED' && n.comment?.id === bobsComment.id,
    );
    expect(reacted).toHaveLength(1);
    expect(reacted[0]?.readAt).toBeNull();

    await carolAgent.put(`/api/v1/posts/${post.id}/like`).expect(204);
    await carolAgent.put(`/api/v1/users/${alice.id}/follow`).expect(204);
    const before = await list(aliceAgent);
    expect(before.filter((n) => n.actor?.username === 'carol').map((n) => n.type)).toEqual([
      'USER_FOLLOWED',
      'POST_LIKED',
    ]);
    await carolAgent.delete(`/api/v1/posts/${post.id}/like`).expect(204);
    await carolAgent.delete(`/api/v1/users/${alice.id}/follow`).expect(204);
    const after = await list(aliceAgent);
    expect(after.filter((n) => n.actor?.username === 'carol')).toEqual([]);
  });

  it('marks one or every notification read; somebody else’s is not found', async () => {
    const post = await createPost(carolAgent, 'Carol here');
    await aliceAgent.put(`/api/v1/posts/${post.id}/like`).expect(204);
    await bobAgent.put(`/api/v1/posts/${post.id}/like`).expect(204);
    const [newest, older] = await list(carolAgent);
    expect(await unread(carolAgent)).toBe(2);

    await carolAgent.post(`/api/v1/notifications/${newest?.id}/read`).expect(204);
    expect(await unread(carolAgent)).toBe(1);
    const marked = (await list(carolAgent)).find((n) => n.id === newest?.id);
    expect(marked?.readAt).toEqual(expect.any(String));
    await carolAgent.post(`/api/v1/notifications/${newest?.id}/read`).expect(204);
    expect((await list(carolAgent)).find((n) => n.id === newest?.id)?.readAt).toBe(marked?.readAt);

    await aliceAgent.post(`/api/v1/notifications/${older?.id}/read`).expect(404);
    await carolAgent.post('/api/v1/notifications/read').expect(204);
    expect(await unread(carolAgent)).toBe(0);
    expect((await list(carolAgent)).every((n) => n.readAt !== null)).toBe(true);
  });

  it('pages with the cursor, newest first', async () => {
    const reader = await createUser(t.prisma);
    const { agent } = await sessionFor(t, reader);
    const posts = await t.prisma.post.createManyAndReturn({
      data: Array.from({ length: 25 }, (_, i) => ({
        authorId: reader.id,
        content: `post ${i}`,
      })),
      select: { id: true },
    });
    await t.prisma.notification.createMany({
      data: posts.map((post, i) => ({
        userId: reader.id,
        type: 'POST_LIKED' as const,
        actorId: bob.id,
        postId: post.id,
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)),
      })),
    });

    const first = notificationListSchema.parse(
      (await agent.get('/api/v1/notifications?limit=20').expect(200)).body,
    );
    expect(first.items).toHaveLength(20);
    expect(first.items[0]?.post?.excerpt).toBe('post 24');
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = notificationListSchema.parse(
      (
        await agent
          .get(
            `/api/v1/notifications?limit=20&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
          )
          .expect(200)
      ).body,
    );
    expect(second.items.map((n) => n.post?.excerpt)).toEqual([
      'post 4',
      'post 3',
      'post 2',
      'post 1',
      'post 0',
    ]);
    expect(second.nextCursor).toBeNull();
    expect(await unread(agent)).toBe(25);
  });

  it('pushes the notification to the recipient’s sockets only', async () => {
    const aliceSocket = await connectAs(t, aliceToken);
    const carolSocket = await connectAs(t, carolToken);
    const toAlice = new Promise<unknown>((resolve) =>
      aliceSocket.once('notification:new', resolve),
    );
    const toCarol = vi.fn();
    carolSocket.on('notification:new', toCarol);
    try {
      const post = await createPost(aliceAgent, 'Push me');
      await bobAgent.put(`/api/v1/posts/${post.id}/like`).expect(204);

      expect(await toAlice).toMatchObject({
        type: 'POST_LIKED',
        actor: { username: 'bob' },
        post: { id: post.id, excerpt: 'Push me' },
        readAt: null,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(toCarol).not.toHaveBeenCalled();
    } finally {
      aliceSocket.disconnect();
      carolSocket.disconnect();
    }
  });
});
