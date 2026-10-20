import { randomUUID } from 'node:crypto';
import { type Post, postListSchema, postSchema } from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

const createPost = async (agent: TestAgent, content: string): Promise<string> =>
  postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body).id;

const getPost = async (agent: TestAgent, id: string): Promise<Post> =>
  postSchema.parse((await agent.get(`/api/v1/posts/${id}`).expect(200)).body);

const bookmarksOf = async (agent: TestAgent, query = '') =>
  postListSchema.parse((await agent.get(`/api/v1/users/me/bookmarks${query}`).expect(200)).body);

describe('bookmarks', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    alice = await createUser(t.prisma);
    bob = await createUser(t.prisma);
    aliceAgent = await agentFor(t, alice);
    bobAgent = await agentFor(t, bob);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('saves and removes a post for the viewer alone, idempotently and without a count', async () => {
    const postId = await createPost(bobAgent, 'Worth keeping');
    await aliceAgent.put(`/api/v1/posts/${postId}/bookmark`).expect(204);
    await aliceAgent.put(`/api/v1/posts/${postId}/bookmark`).expect(204);

    expect(await getPost(aliceAgent, postId)).toMatchObject({
      bookmarkedByMe: true,
      likedByMe: false,
      likeCount: 0,
    });
    expect((await getPost(bobAgent, postId)).bookmarkedByMe).toBe(false);
    expect((await bookmarksOf(aliceAgent)).items.map((post) => post.id)).toEqual([postId]);
    expect((await bookmarksOf(bobAgent)).items).toEqual([]);

    await aliceAgent.delete(`/api/v1/posts/${postId}/bookmark`).expect(204);
    await aliceAgent.delete(`/api/v1/posts/${postId}/bookmark`).expect(204);
    expect((await getPost(aliceAgent, postId)).bookmarkedByMe).toBe(false);
    expect((await bookmarksOf(aliceAgent)).items).toEqual([]);

    await aliceAgent.put(`/api/v1/posts/${randomUUID()}/bookmark`).expect(404);
    await aliceAgent.delete(`/api/v1/posts/${randomUUID()}/bookmark`).expect(404);
    await request(t.server).get('/api/v1/users/me/bookmarks').expect(401);
  });

  it('lists newest save first with a cursor, flags the posts in other lists, and forgets a deleted post', async () => {
    const first = await createPost(bobAgent, 'saved first');
    const second = await createPost(bobAgent, 'saved second');
    const third = await createPost(bobAgent, 'saved third');
    for (const id of [first, second, third]) {
      // oxlint-disable-next-line no-await-in-loop -- the order of the saves is the point
      await aliceAgent.put(`/api/v1/posts/${id}/bookmark`).expect(204);
    }

    const page1 = await bookmarksOf(aliceAgent, '?limit=2');
    expect(page1.items.map((post) => post.id)).toEqual([third, second]);
    expect(page1.nextCursor).toEqual(expect.any(String));
    const page2 = await bookmarksOf(
      aliceAgent,
      `?limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? '')}`,
    );
    expect(page2.items.map((post) => post.id)).toEqual([first]);
    expect(page2.nextCursor).toBeNull();

    const bobs = postListSchema.parse(
      (await aliceAgent.get(`/api/v1/users/${bob.id}/posts`).expect(200)).body,
    );
    expect(bobs.items.filter((post) => post.bookmarkedByMe).map((post) => post.content)).toEqual([
      'saved third',
      'saved second',
      'saved first',
    ]);

    await bobAgent.delete(`/api/v1/posts/${third}`).expect(204);
    expect((await bookmarksOf(aliceAgent)).items.map((post) => post.id)).toEqual([second, first]);
  });
});
