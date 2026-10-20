import { postSchema, revisionListSchema } from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type TestAgent, createUser, login } from './setup/factories.js';

describe('revision lists page (review L14)', () => {
  let t: TestApp;
  let agent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    const me = await createUser(t.prisma);
    agent = request.agent(t.server);
    await login(agent, me.email);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('walks every previous version of a post with the cursor, newest replacement first', async () => {
    const post = postSchema.parse(
      (await agent.post('/api/v1/posts').send({ content: 'v1' }).expect(201)).body,
    );
    for (const content of ['v2', 'v3', 'v4']) {
      // Sequential on purpose: the order of the edits is what the pages are about.
      // oxlint-disable-next-line no-await-in-loop
      await agent.patch(`/api/v1/posts/${post.id}`).send({ content }).expect(200);
    }

    const first = revisionListSchema.parse(
      (await agent.get(`/api/v1/posts/${post.id}/revisions?limit=2`).expect(200)).body,
    );
    expect(first.items.map((revision) => revision.content)).toEqual(['v3', 'v2']);
    expect(first.nextCursor).not.toBeNull();

    const second = revisionListSchema.parse(
      (
        await agent
          .get(`/api/v1/posts/${post.id}/revisions?limit=2&cursor=${first.nextCursor}`)
          .expect(200)
      ).body,
    );
    expect(second.items.map((revision) => revision.content)).toEqual(['v1']);
    expect(second.nextCursor).toBeNull();
  });

  it('pages comment revisions the same way', async () => {
    const post = postSchema.parse(
      (await agent.post('/api/v1/posts').send({ content: 'host' }).expect(201)).body,
    );
    const comment = (
      await agent.post(`/api/v1/posts/${post.id}/comments`).send({ content: 'c1' }).expect(201)
    ).body as { id: string };
    await agent.patch(`/api/v1/comments/${comment.id}`).send({ content: 'c2' }).expect(200);
    await agent.patch(`/api/v1/comments/${comment.id}`).send({ content: 'c3' }).expect(200);

    const page = revisionListSchema.parse(
      (await agent.get(`/api/v1/comments/${comment.id}/revisions?limit=1`).expect(200)).body,
    );
    expect(page.items.map((revision) => revision.content)).toEqual(['c2']);
    expect(page.nextCursor).not.toBeNull();
  });
});
