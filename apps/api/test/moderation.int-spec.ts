import { randomUUID } from 'node:crypto';
import {
  type Post,
  type UserPublic,
  activityListSchema,
  apiErrorSchema,
  commentListSchema,
  commentSchema,
  conversationListSchema,
  conversationSchema,
  memberListSchema,
  notificationListSchema,
  postListSchema,
  postSchema,
  reportSchema,
  userListSchema,
  userPublicSchema,
} from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

const createPost = async (agent: TestAgent, content: string): Promise<Post> =>
  postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body);
const profile = async (agent: TestAgent, username: string): Promise<UserPublic> =>
  userPublicSchema.parse(
    (await agent.get(`/api/v1/users/by-username/${username}`).expect(200)).body,
  );
const postIds = async (agent: TestAgent, path: string): Promise<string[]> =>
  postListSchema
    .parse((await agent.get(`/api/v1${path}`).expect(200)).body)
    .items.map((post) => post.id);
const codeOf = (body: unknown): string => apiErrorSchema.parse(body).code;

describe('moderation: block, mute, report (ADR 0016)', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let carol: CreatedUser;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;
  let carolAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    alice = await createUser(t.prisma, { username: 'alice', bio: 'Hello' });
    bob = await createUser(t.prisma, { username: 'bob', bio: 'Hey' });
    carol = await createUser(t.prisma, { username: 'carol' });
    aliceAgent = await agentFor(t, alice);
    bobAgent = await agentFor(t, bob);
    carolAgent = await agentFor(t, carol);
    await aliceAgent.put(`/api/v1/users/${bob.id}/follow`).expect(204);
    await bobAgent.put(`/api/v1/users/${alice.id}/follow`).expect(204);
    await carolAgent.put(`/api/v1/users/${alice.id}/follow`).expect(204);
    await carolAgent.put(`/api/v1/users/${bob.id}/follow`).expect(204);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('a block cuts everything between the two, both ways, until it is lifted', async () => {
    const alicePost = await createPost(aliceAgent, 'Alice here #blocktest');
    const bobPost = await createPost(bobAgent, 'Bob here #blocktest');
    const bobsComment = commentSchema.parse(
      (
        await bobAgent
          .post(`/api/v1/posts/${alicePost.id}/comments`)
          .send({ content: 'bob was here' })
          .expect(201)
      ).body,
    );
    await bobAgent.put(`/api/v1/posts/${alicePost.id}/like`).expect(204);
    const thread = conversationSchema.parse(
      (await aliceAgent.put(`/api/v1/conversations/direct/${bob.id}`).expect(200)).body,
    );
    await aliceAgent
      .post(`/api/v1/conversations/${thread.id}/messages`)
      .send({ content: 'hi bob' })
      .expect(201);

    await aliceAgent.put(`/api/v1/users/${bob.id}/block`).expect(204);
    await aliceAgent.put(`/api/v1/users/${bob.id}/block`).expect(204);
    await aliceAgent.put(`/api/v1/users/${alice.id}/block`).expect(400);

    // The follows between them went with the block, and no new one is taken.
    expect(await profile(aliceAgent, 'bob')).toMatchObject({
      blocked: true,
      blockedMe: false,
      bio: null,
      counts: { posts: 0, followers: 0, following: 0 },
      followedByMe: false,
      followsMe: false,
    });
    expect(await profile(bobAgent, 'alice')).toMatchObject({ blocked: false, blockedMe: true });
    expect(codeOf((await aliceAgent.put(`/api/v1/users/${bob.id}/follow`).expect(403)).body)).toBe(
      'BLOCKED',
    );
    await bobAgent.put(`/api/v1/users/${alice.id}/follow`).expect(403);

    // Posts: not in feeds, profiles, tag pages, search or bookmarks, and not by address either.
    expect(await postIds(aliceAgent, '/posts')).not.toContain(bobPost.id);
    expect(await postIds(bobAgent, '/posts')).not.toContain(alicePost.id);
    expect(await postIds(carolAgent, '/posts')).toEqual(
      expect.arrayContaining([alicePost.id, bobPost.id]),
    );
    expect(await postIds(aliceAgent, `/users/${bob.id}/posts`)).toEqual([]);
    expect(await postIds(bobAgent, `/users/${alice.id}/posts`)).toEqual([]);
    expect(await postIds(aliceAgent, '/tags/blocktest/posts')).toEqual([alicePost.id]);
    expect(await postIds(aliceAgent, '/search/posts?q=blocktest')).toEqual([alicePost.id]);
    await aliceAgent.get(`/api/v1/posts/${bobPost.id}`).expect(404);
    await bobAgent.get(`/api/v1/posts/${alicePost.id}`).expect(404);

    // Neither can act on the other's things.
    await aliceAgent.put(`/api/v1/posts/${bobPost.id}/like`).expect(403);
    await aliceAgent.put(`/api/v1/posts/${bobPost.id}/repost`).expect(403);
    await aliceAgent
      .post('/api/v1/posts')
      .send({ content: 'quoting', quotedPostId: bobPost.id })
      .expect(403);
    await bobAgent
      .post(`/api/v1/posts/${alicePost.id}/comments`)
      .send({ content: 'again' })
      .expect(403);
    const comments = commentListSchema.parse(
      (await aliceAgent.get(`/api/v1/posts/${alicePost.id}/comments`).expect(200)).body,
    );
    expect(comments.items.map((comment) => comment.id)).not.toContain(bobsComment.id);
    expect(
      commentListSchema
        .parse((await carolAgent.get(`/api/v1/posts/${alicePost.id}/comments`).expect(200)).body)
        .items.map((comment) => comment.id),
    ).toContain(bobsComment.id);

    // The direct thread is closed to both and gone from the list; nothing new can start.
    const threads = conversationListSchema.parse(
      (await aliceAgent.get('/api/v1/conversations').expect(200)).body,
    );
    expect(threads.items.map((row) => row.id)).not.toContain(thread.id);
    await aliceAgent.get(`/api/v1/conversations/${thread.id}`).expect(404);
    await bobAgent
      .post(`/api/v1/conversations/${thread.id}/messages`)
      .send({ content: 'still there?' })
      .expect(404);
    await bobAgent.put(`/api/v1/conversations/direct/${alice.id}`).expect(403);

    // People: neither finds the other; a mention tells nobody.
    const people = userListSchema.parse(
      (await aliceAgent.get('/api/v1/users?q=bob').expect(200)).body,
    );
    expect(people.items.map((user) => user.id)).not.toContain(bob.id);
    await bobAgent.post('/api/v1/posts').send({ content: 'ping @alice' }).expect(201);
    const mine = notificationListSchema.parse(
      (await aliceAgent.get('/api/v1/notifications').expect(200)).body,
    );
    expect(mine.items.some((item) => item.actor.id === bob.id)).toBe(false);

    const blocked = memberListSchema.parse(
      (await aliceAgent.get('/api/v1/users/me/blocked?limit=1').expect(200)).body,
    );
    expect(blocked.items.map((user) => user.username)).toEqual(['bob']);
    expect(blocked.nextCursor).toBeNull();

    // Lifted: the profile and the posts are back; the follows stay gone.
    await aliceAgent.delete(`/api/v1/users/${bob.id}/block`).expect(204);
    expect(await profile(aliceAgent, 'bob')).toMatchObject({
      blocked: false,
      bio: 'Hey',
      followedByMe: false,
      followsMe: false,
    });
    await aliceAgent.get(`/api/v1/posts/${bobPost.id}`).expect(200);
    expect(await postIds(aliceAgent, `/users/${bob.id}/posts`)).toContain(bobPost.id);
    await aliceAgent.get(`/api/v1/conversations/${thread.id}`).expect(200);
  });

  it('a mute quiets one member for the muter alone', async () => {
    const bobPost = await createPost(bobAgent, 'Bob again #mutetest');
    const carolPost = await createPost(carolAgent, 'Carol here');
    await carolAgent.put(`/api/v1/users/${bob.id}/mute`).expect(204);
    await carolAgent.put(`/api/v1/users/${bob.id}/mute`).expect(204);
    await carolAgent.put(`/api/v1/users/${carol.id}/mute`).expect(400);

    expect(await postIds(carolAgent, '/posts')).not.toContain(bobPost.id);
    expect(await postIds(carolAgent, '/tags/mutetest/posts')).toEqual([]);
    expect(await postIds(carolAgent, '/search/posts?q=mutetest')).toEqual([]);
    // Her own visit to his page still shows everything; the profile is whole, just flagged.
    expect(await postIds(carolAgent, `/users/${bob.id}/posts`)).toContain(bobPost.id);
    expect(await profile(carolAgent, 'bob')).toMatchObject({ muted: true, bio: 'Hey' });
    await carolAgent.get(`/api/v1/posts/${bobPost.id}`).expect(200);
    // Bob notices nothing and can still interact; carol just is not told.
    expect(await profile(bobAgent, 'carol')).toMatchObject({ muted: false, blockedMe: false });
    await bobAgent.put(`/api/v1/posts/${carolPost.id}/like`).expect(204);
    await bobAgent
      .post(`/api/v1/posts/${carolPost.id}/comments`)
      .send({ content: 'nice' })
      .expect(201);
    const mine = notificationListSchema.parse(
      (await carolAgent.get('/api/v1/notifications').expect(200)).body,
    );
    expect(mine.items.some((item) => item.actor.id === bob.id)).toBe(false);
    const activity = activityListSchema.parse(
      (await carolAgent.get('/api/v1/activities').expect(200)).body,
    );
    expect(activity.items.some((item) => item.actor.id === bob.id)).toBe(false);

    const muted = memberListSchema.parse(
      (await carolAgent.get('/api/v1/users/me/muted').expect(200)).body,
    );
    expect(muted.items.map((user) => user.username)).toEqual(['bob']);
    await carolAgent.delete(`/api/v1/users/${bob.id}/mute`).expect(204);
    expect(await postIds(carolAgent, '/posts')).toContain(bobPost.id);
    expect(await profile(carolAgent, 'bob')).toMatchObject({ muted: false });
  });

  it('takes one open report per member and target, and refuses the rest', async () => {
    const bobPost = await createPost(bobAgent, 'Report me');
    const comment = commentSchema.parse(
      (
        await bobAgent
          .post(`/api/v1/posts/${bobPost.id}/comments`)
          .send({ content: 'and me' })
          .expect(201)
      ).body,
    );
    const filed = reportSchema.parse(
      (
        await carolAgent
          .post('/api/v1/reports')
          .send({ targetType: 'post', targetId: bobPost.id, reason: 'spam', details: ' ads ' })
          .expect(201)
      ).body,
    );
    expect(filed).toMatchObject({
      targetType: 'post',
      targetId: bobPost.id,
      reason: 'spam',
      details: 'ads',
      status: 'open',
    });
    await carolAgent
      .post('/api/v1/reports')
      .send({ targetType: 'post', targetId: bobPost.id, reason: 'hate' })
      .expect(409);
    await carolAgent
      .post('/api/v1/reports')
      .send({ targetType: 'comment', targetId: comment.id, reason: 'harassment' })
      .expect(201);
    await carolAgent
      .post('/api/v1/reports')
      .send({ targetType: 'user', targetId: bob.id, reason: 'other', details: '' })
      .expect(201);
    await bobAgent
      .post('/api/v1/reports')
      .send({ targetType: 'post', targetId: bobPost.id, reason: 'spam' })
      .expect(400);
    await bobAgent
      .post('/api/v1/reports')
      .send({ targetType: 'user', targetId: bob.id, reason: 'spam' })
      .expect(400);
    await carolAgent
      .post('/api/v1/reports')
      .send({ targetType: 'post', targetId: randomUUID(), reason: 'spam' })
      .expect(404);
    await carolAgent
      .post('/api/v1/reports')
      .send({ targetType: 'post', targetId: bobPost.id, reason: 'boring' })
      .expect(400);
    expect(await t.prisma.report.count({ where: { reporterId: carol.id } })).toBe(3);
  });
});
