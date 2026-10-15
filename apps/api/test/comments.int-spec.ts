import { apiErrorSchema, commentListSchema, commentSchema, postSchema } from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

async function createPost(agent: TestAgent, content: string): Promise<string> {
  return postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body)
    .id;
}

async function comment(agent: TestAgent, postId: string, content: string): Promise<string> {
  return commentSchema.parse(
    (await agent.post(`/api/v1/posts/${postId}/comments`).send({ content }).expect(201)).body,
  ).id;
}

const MISSING = '00000000-0000-7000-8000-000000000000';

describe('comments', () => {
  let t: TestApp;
  let poster: CreatedUser;
  let commenter: CreatedUser;
  let posterAgent: TestAgent;
  let commenterAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    poster = await createUser(t.prisma);
    commenter = await createUser(t.prisma);
    posterAgent = await agentFor(t, poster);
    commenterAgent = await agentFor(t, commenter);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('creates a comment and bumps the post comment count', async () => {
    const postId = await createPost(posterAgent, 'discuss');

    const response = await commenterAgent
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: '  Nice!  ' })
      .expect(201);
    const created = commentSchema.parse(response.body);

    expect(created).toMatchObject({
      postId,
      content: 'Nice!',
      author: { id: commenter.id, username: commenter.username },
    });
    expect(
      postSchema.parse((await posterAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
        .commentCount,
    ).toBe(1);
  });

  it('validates content and the post', async () => {
    const postId = await createPost(posterAgent, 'validate');

    const empty = await commenterAgent
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: '  ' })
      .expect(400);
    expect(apiErrorSchema.parse(empty.body).fields).toHaveProperty('content');
    await commenterAgent
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: 'x'.repeat(501) })
      .expect(400);
    await commenterAgent
      .post(`/api/v1/posts/${MISSING}/comments`)
      .send({ content: 'hi' })
      .expect(404);
    await request(t.server)
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: 'hi' })
      .expect(401);
  });

  it('lists comments newest first with cursor paging', async () => {
    const postId = await createPost(posterAgent, 'thread');
    const first = await comment(commenterAgent, postId, 'first');
    const second = await comment(posterAgent, postId, 'second');
    const third = await comment(commenterAgent, postId, 'third');

    const page1 = commentListSchema.parse(
      (await posterAgent.get(`/api/v1/posts/${postId}/comments?limit=2`).expect(200)).body,
    );
    expect(page1.items.map((c) => c.id)).toEqual([third, second]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = commentListSchema.parse(
      (
        await posterAgent
          .get(`/api/v1/posts/${postId}/comments?limit=2&cursor=${page1.nextCursor}`)
          .expect(200)
      ).body,
    );
    expect(page2.items.map((c) => c.id)).toEqual([first]);
    expect(page2.nextCursor).toBeNull();

    await posterAgent.get(`/api/v1/posts/${MISSING}/comments`).expect(404);
  });

  describe('DELETE /comments/:id', () => {
    it('is allowed for the comment author and for the post author, nobody else', async () => {
      const stranger = await createUser(t.prisma);
      const strangerAgent = await agentFor(t, stranger);
      const postId = await createPost(posterAgent, 'moderated');
      const byCommenter = await comment(commenterAgent, postId, 'mine');
      const byCommenterToo = await comment(commenterAgent, postId, 'also mine');

      const forbidden = await strangerAgent.delete(`/api/v1/comments/${byCommenter}`).expect(403);
      expect(apiErrorSchema.parse(forbidden.body).code).toBe('FORBIDDEN');

      await commenterAgent.delete(`/api/v1/comments/${byCommenter}`).expect(204);
      await posterAgent.delete(`/api/v1/comments/${byCommenterToo}`).expect(204);
      await commenterAgent.delete(`/api/v1/comments/${byCommenter}`).expect(404);

      const list = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/posts/${postId}/comments`).expect(200)).body,
      );
      expect(list.items).toHaveLength(0);
      expect(
        postSchema.parse((await posterAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
          .commentCount,
      ).toBe(0);
    });

    it('comments disappear with their post', async () => {
      const postId = await createPost(posterAgent, 'temporary');
      const id = await comment(commenterAgent, postId, 'gone soon');

      await posterAgent.delete(`/api/v1/posts/${postId}`).expect(204);

      expect(await t.prisma.comment.count({ where: { id } })).toBe(0);
    });
  });
});
