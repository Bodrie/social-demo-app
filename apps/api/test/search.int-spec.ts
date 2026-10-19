import { apiErrorSchema, commentSchema, postListSchema, postSchema } from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

async function createPost(agent: TestAgent, content: string) {
  const response = await agent.post('/api/v1/posts').send({ content }).expect(201);
  return postSchema.parse(response.body);
}

async function search(agent: TestAgent, q: string, extra = '') {
  const response = await agent
    .get(`/api/v1/search/posts?q=${encodeURIComponent(q)}${extra}`)
    .expect(200);
  return postListSchema.parse(response.body);
}

describe('GET /search/posts', () => {
  let t: TestApp;
  let agent: TestAgent;
  let me: CreatedUser;

  beforeAll(async () => {
    t = await createTestApp();
    me = await createUser(t.prisma);
    agent = await agentFor(t, me);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('matches whole words in any case and order, newest first, in the feed shape', async () => {
    const older = await createPost(agent, 'Hiking boots for sale, barely worn');
    const newer = await createPost(agent, 'Sold the BOOTS. Hiking resumes Saturday.');
    await createPost(agent, 'Nothing about footwear here');

    const page = await search(agent, 'hiking boots');

    expect(page.items.map((post) => post.id)).toEqual([newer.id, older.id]);
    expect(page.items[0]).toMatchObject({
      author: { id: me.id },
      likeCount: 0,
      likedByMe: false,
      mentions: [],
      hashtags: [],
    });
    expect(page.nextCursor).toBeNull();
  });

  it('understands quoted phrases, "or" and -exclusions', async () => {
    const phrase = await createPost(agent, 'the quick brown fox jumps');
    const scrambled = await createPost(agent, 'brown jumps the fox quick');
    const other = await createPost(agent, 'a slow green turtle');

    const quoted = await search(agent, '"quick brown fox"');
    expect(quoted.items.map((post) => post.id)).toEqual([phrase.id]);

    const either = await search(agent, 'turtle or fox');
    expect(either.items.map((post) => post.id).toSorted()).toEqual(
      [phrase.id, scrambled.id, other.id].toSorted(),
    );

    const excluded = await search(agent, 'fox -quick');
    expect(excluded.items).toEqual([]);
  });

  it('pages with the usual cursor and ignores the page size past the limit', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) ids.push((await createPost(agent, `paging marker ${i}`)).id);

    const first = await search(agent, 'paging marker', '&limit=2');
    expect(first.items.map((post) => post.id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).not.toBeNull();

    const second = await search(agent, 'paging marker', `&limit=2&cursor=${first.nextCursor}`);
    expect(second.items.map((post) => post.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();
  });

  it('indexes edits and forgets deleted posts', async () => {
    const post = await createPost(agent, 'original wording here');
    await agent
      .patch(`/api/v1/posts/${post.id}`)
      .send({ content: 'rewritten completely' })
      .expect(200);

    expect((await search(agent, 'original wording')).items).toEqual([]);
    expect((await search(agent, 'rewritten')).items.map((p) => p.id)).toEqual([post.id]);

    await agent.delete(`/api/v1/posts/${post.id}`).expect(204);
    expect((await search(agent, 'rewritten')).items).toEqual([]);
  });

  it('treats the query as text, never as SQL or tsquery operators', async () => {
    await createPost(agent, 'injection probe post');
    for (const q of ["'; DROP TABLE posts; --", 'probe & | ! ( )', 'probe:*', '\\\\']) {
      const page = await search(agent, q);
      expect(Array.isArray(page.items)).toBe(true);
    }
    expect((await search(agent, 'probe')).items).toHaveLength(1);
  });

  it('validates the query length', async () => {
    for (const q of ['a', 'x'.repeat(101)]) {
      const response = await agent.get(`/api/v1/search/posts?q=${q}`).expect(400);
      const error = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fields).toHaveProperty('q');
    }
    await agent.get('/api/v1/search/posts').expect(400);
  });

  it('needs a session', async () => {
    await request(t.server).get('/api/v1/search/posts?q=hello').expect(401);
  });
});

describe('GET /comments/:id', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('answers one comment to any member and 404 for an unknown id', async () => {
    const author = await createUser(t.prisma);
    const reader = await createUser(t.prisma);
    const authorAgent = await agentFor(t, author);
    const post = await createPost(authorAgent, 'with a comment');
    const created = commentSchema.parse(
      (
        await authorAgent
          .post(`/api/v1/posts/${post.id}/comments`)
          .send({ content: `hello @${reader.username}` })
          .expect(201)
      ).body,
    );

    const readerAgent = await agentFor(t, reader);
    const fetched = commentSchema.parse(
      (await readerAgent.get(`/api/v1/comments/${created.id}`).expect(200)).body,
    );
    expect(fetched).toMatchObject({
      id: created.id,
      postId: post.id,
      content: `hello @${reader.username}`,
      mentions: [{ id: reader.id }],
    });

    await readerAgent.get('/api/v1/comments/01a13ed6-d3ec-71cb-b39f-fbc256a293b9').expect(404);
  });
});
