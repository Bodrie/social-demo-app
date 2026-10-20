import { randomUUID } from 'node:crypto';
import {
  type Post,
  accountExportSchema,
  activityListSchema,
  apiErrorSchema,
  notificationListSchema,
  postListSchema,
  postSchema,
} from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

const createPost = async (
  agent: TestAgent,
  body: { content: string; quotedPostId?: string },
): Promise<Post> =>
  postSchema.parse((await agent.post('/api/v1/posts').send(body).expect(201)).body);

const getPost = async (agent: TestAgent, id: string): Promise<Post> =>
  postSchema.parse((await agent.get(`/api/v1/posts/${id}`).expect(200)).body);

const list = async (agent: TestAgent, path: string) =>
  postListSchema.parse((await agent.get(`/api/v1${path}`).expect(200)).body);

/** `id` with who reposted it, or `id` alone: the shape of a feed read in one glance. */
const shapeOf = (items: Post[]) =>
  items.map((post) => (post.repost ? `${post.id} by ${post.repost.by.username}` : post.id));

describe('reposts and quotes', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let carol: CreatedUser;
  let dave: CreatedUser;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;
  let carolAgent: TestAgent;
  let daveAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    alice = await createUser(t.prisma, { username: 'alice' });
    bob = await createUser(t.prisma, { username: 'bob' });
    carol = await createUser(t.prisma, { username: 'carol' });
    dave = await createUser(t.prisma, { username: 'dave' });
    aliceAgent = await agentFor(t, alice);
    bobAgent = await agentFor(t, bob);
    carolAgent = await agentFor(t, carol);
    daveAgent = await agentFor(t, dave);
    // carol follows bob only; dave follows alice and bob.
    await carolAgent.put(`/api/v1/users/${bob.id}/follow`).expect(204);
    await daveAgent.put(`/api/v1/users/${alice.id}/follow`).expect(204);
    await daveAgent.put(`/api/v1/users/${bob.id}/follow`).expect(204);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('toggles a plain repost: once per member, never of one’s own post, counted on the post', async () => {
    const post = await createPost(aliceAgent, { content: 'Repost me' });
    await aliceAgent.put(`/api/v1/posts/${post.id}/repost`).expect(400);
    await bobAgent.put(`/api/v1/posts/${post.id}/repost`).expect(204);
    await bobAgent.put(`/api/v1/posts/${post.id}/repost`).expect(204);
    await carolAgent.put(`/api/v1/posts/${post.id}/repost`).expect(204);

    expect(await getPost(bobAgent, post.id)).toMatchObject({ repostCount: 2, repostedByMe: true });
    expect(await getPost(aliceAgent, post.id)).toMatchObject({
      repostCount: 2,
      repostedByMe: false,
    });

    await bobAgent.delete(`/api/v1/posts/${post.id}/repost`).expect(204);
    await bobAgent.delete(`/api/v1/posts/${post.id}/repost`).expect(204);
    expect(await getPost(bobAgent, post.id)).toMatchObject({ repostCount: 1, repostedByMe: false });
    await bobAgent.put(`/api/v1/posts/${randomUUID()}/repost`).expect(404);
    await carolAgent.delete(`/api/v1/posts/${post.id}/repost`).expect(204);
    // Both undos took their notification with them.
    const left = notificationListSchema.parse(
      (await aliceAgent.get('/api/v1/notifications').expect(200)).body,
    );
    expect(left.items.filter((item) => item.type === 'POST_REPOSTED')).toEqual([]);
    await aliceAgent.delete(`/api/v1/posts/${post.id}`).expect(204);
  });

  it('makes a quote a post of its own that embeds the original, one level deep', async () => {
    const original = await createPost(aliceAgent, { content: 'Quote me #tag' });
    const refused = await bobAgent
      .post('/api/v1/posts')
      .send({ content: 'Quoting nothing', quotedPostId: randomUUID() })
      .expect(400);
    expect(apiErrorSchema.parse(refused.body).fields).toHaveProperty('quotedPostId');

    const quote = await createPost(bobAgent, {
      content: 'Worth a second look @alice',
      quotedPostId: original.id,
    });
    expect(quote.quotedPost).toEqual({
      id: original.id,
      author: expect.objectContaining({ username: 'alice' }),
      content: 'Quote me #tag',
      imageUrl: null,
      createdAt: original.createdAt,
    });
    expect(quote.mentions.map((user) => user.username)).toEqual(['alice']);
    expect(quote.repost).toBeNull();
    expect((await getPost(aliceAgent, original.id)).repostCount).toBe(1);

    const nested = await createPost(carolAgent, { content: 'And again', quotedPostId: quote.id });
    expect(nested.quotedPost).toMatchObject({
      id: quote.id,
      content: 'Worth a second look @alice',
    });
    expect((await getPost(carolAgent, quote.id)).repostCount).toBe(1);

    // A quote is a post: it can be reposted and searched for; its deletion un-counts it.
    await aliceAgent.put(`/api/v1/posts/${quote.id}/repost`).expect(204);
    expect((await getPost(aliceAgent, quote.id)).repostCount).toBe(2);
    const found = await list(aliceAgent, '/search/posts?q=second');
    expect(found.items.map((post) => post.id)).toEqual([quote.id]);
    await carolAgent.delete(`/api/v1/posts/${nested.id}`).expect(204);
    expect((await getPost(aliceAgent, quote.id)).repostCount).toBe(1);

    // The original goes: the quote keeps the frame.
    await aliceAgent.delete(`/api/v1/posts/${original.id}`).expect(204);
    expect((await getPost(bobAgent, quote.id)).quotedPost).toEqual({ unavailable: true });
    await bobAgent.delete(`/api/v1/posts/${quote.id}`).expect(204);
  });

  it('builds the feed from posts and reposts, one row per post at its newest occurrence', async () => {
    const alicePost = await createPost(aliceAgent, { content: 'Alice original' });
    const bobPost = await createPost(bobAgent, { content: 'Bob original' });
    await bobAgent.put(`/api/v1/posts/${alicePost.id}/repost`).expect(204);
    const bobLater = await createPost(bobAgent, { content: 'Bob later' });

    // carol follows bob only: she sees alice's post through bob, at the time of the repost.
    const carolFeed = await list(carolAgent, '/posts');
    expect(shapeOf(carolFeed.items)).toEqual([bobLater.id, `${alicePost.id} by bob`, bobPost.id]);
    const viaBob = carolFeed.items.find((post) => post.id === alicePost.id);
    expect(viaBob?.author.username).toBe('alice');
    expect(viaBob?.repost?.by.username).toBe('bob');

    // dave follows both: the post appears once, as bob's repost (the newer occurrence).
    const daveFeed = await list(daveAgent, '/posts');
    expect(shapeOf(daveFeed.items)).toEqual([bobLater.id, `${alicePost.id} by bob`, bobPost.id]);

    // The profile shows what bob reposted among his posts; `include=own` leaves it out.
    const profile = await list(aliceAgent, `/users/${bob.id}/posts`);
    expect(shapeOf(profile.items)).toEqual([bobLater.id, `${alicePost.id} by bob`, bobPost.id]);
    const own = await list(aliceAgent, `/users/${bob.id}/posts?include=own`);
    expect(shapeOf(own.items)).toEqual([bobLater.id, bobPost.id]);

    // Paging over a repost that is undone in between: nothing is shown twice or skipped.
    const page1 = await list(daveAgent, '/posts?limit=2');
    expect(shapeOf(page1.items)).toEqual([bobLater.id, `${alicePost.id} by bob`]);
    await bobAgent.delete(`/api/v1/posts/${alicePost.id}/repost`).expect(204);
    const page2 = await list(daveAgent, `/posts?limit=5&cursor=${page1.nextCursor ?? ''}`);
    // alice's post is now only where it was published, which is older than bob's post.
    expect(shapeOf(page2.items)).toEqual([bobPost.id, alicePost.id]);
    expect(shapeOf((await list(carolAgent, '/posts')).items)).toEqual([bobLater.id, bobPost.id]);

    await aliceAgent.delete(`/api/v1/posts/${alicePost.id}`).expect(204);
    await bobAgent.delete(`/api/v1/posts/${bobPost.id}`).expect(204);
    await bobAgent.delete(`/api/v1/posts/${bobLater.id}`).expect(204);
  });

  it('tells the followers and the author, and takes it back on undo', async () => {
    const post = await createPost(aliceAgent, { content: 'Tell everyone' });
    await bobAgent.put(`/api/v1/posts/${post.id}/repost`).expect(204);
    const quote = await createPost(bobAgent, { content: 'My take', quotedPostId: post.id });

    const activity = activityListSchema.parse(
      (await carolAgent.get('/api/v1/activities').expect(200)).body,
    );
    expect(
      activity.items.slice(0, 2).map((item) => [item.type, item.targetUser?.username]),
    ).toEqual([
      ['POST_QUOTED', 'alice'],
      ['POST_REPOSTED', 'alice'],
    ]);
    expect(activity.items[0]?.post).toMatchObject({ id: quote.id, excerpt: 'My take' });
    expect(
      activity.items.some((item) => item.type === 'POST_CREATED' && item.post?.id === quote.id),
    ).toBe(false);

    const mine = notificationListSchema.parse(
      (await aliceAgent.get('/api/v1/notifications').expect(200)).body,
    );
    expect(mine.items.slice(0, 2).map((item) => [item.type, item.post?.id])).toEqual([
      ['POST_QUOTED', quote.id],
      ['POST_REPOSTED', post.id],
    ]);

    await bobAgent.delete(`/api/v1/posts/${post.id}/repost`).expect(204);
    const after = notificationListSchema.parse(
      (await aliceAgent.get('/api/v1/notifications').expect(200)).body,
    );
    expect(
      after.items
        .filter((item) => item.type === 'POST_REPOSTED')
        .map((item) => [item.actor.username, item.post?.excerpt]),
    ).toEqual([]);
    expect(
      activityListSchema
        .parse((await carolAgent.get('/api/v1/activities').expect(200)).body)
        .items.some((item) => item.type === 'POST_REPOSTED'),
    ).toBe(false);

    const exported = accountExportSchema.parse(
      (await bobAgent.get('/api/v1/users/me/export').expect(200)).body,
    );
    expect(exported.reposts).toEqual([]);
    await bobAgent.put(`/api/v1/posts/${post.id}/repost`).expect(204);
  });
});
