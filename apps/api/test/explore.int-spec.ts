import { postListSchema, postSchema } from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

describe('explore', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function member(): Promise<{ user: CreatedUser; agent: TestAgent }> {
    const user = await createUser(t.prisma);
    const agent = request.agent(t.server);
    await login(agent, user.email);
    return { user, agent };
  }

  const post = async (agent: TestAgent, content: string, quotedPostId?: string) =>
    postSchema.parse(
      (await agent.post('/api/v1/posts').send({ content, quotedPostId }).expect(201)).body,
    );

  const explore = async (agent: TestAgent, query: string) =>
    postListSchema.parse((await agent.get(`/api/v1/explore/posts?${query}`).expect(200)).body);

  it('lists everyone’s posts and quotes newest first, without plain reposts or hidden people', async () => {
    await t.prisma.post.deleteMany();
    const [viewer, stranger, muted, blocker] = [
      await member(),
      await member(),
      await member(),
      await member(),
    ];
    const original = await post(stranger.agent, 'From a stranger');
    const quote = await post(viewer.agent, 'Look at this', original.id);
    await viewer.agent.put(`/api/v1/posts/${original.id}/repost`).expect(204);
    await post(muted.agent, 'Muted words');
    await post(blocker.agent, 'From someone who blocked me');
    await viewer.agent.put(`/api/v1/users/${muted.user.id}/mute`).expect(204);
    await blocker.agent.put(`/api/v1/users/${viewer.user.id}/block`).expect(204);

    const latest = await explore(viewer.agent, 'sort=latest');
    expect(latest.items.map((item) => item.content)).toEqual(['Look at this', 'From a stranger']);
    expect(latest.items.every((item) => item.repost === null)).toBe(true);
    expect(latest.items[0]?.id).toBe(quote.id);
    // Latest is the default.
    expect((await explore(viewer.agent, '')).items).toEqual(latest.items);
  });

  it('ranks the last week by likes + 2 × comments + reposts and pages through the ranking', async () => {
    await t.prisma.post.deleteMany();
    const [author, a, b, c] = [await member(), await member(), await member(), await member()];
    const liked = await post(author.agent, 'Three likes');
    const discussed = await post(author.agent, 'Two comments');
    const reposted = await post(author.agent, 'One repost');
    const quiet = await post(author.agent, 'Nobody cared');
    const old = await post(author.agent, 'Popular long ago');
    for (const fan of [a, b, c]) {
      // oxlint-disable-next-line no-await-in-loop -- a handful of setup calls
      await fan.agent.put(`/api/v1/posts/${liked.id}/like`).expect(204);
      // oxlint-disable-next-line no-await-in-loop -- a handful of setup calls
      await fan.agent.put(`/api/v1/posts/${old.id}/like`).expect(204);
    }
    for (const fan of [a, b]) {
      // oxlint-disable-next-line no-await-in-loop -- a handful of setup calls
      await fan.agent
        .post(`/api/v1/posts/${discussed.id}/comments`)
        .send({ content: 'Agreed' })
        .expect(201);
    }
    await a.agent.put(`/api/v1/posts/${reposted.id}/repost`).expect(204);
    await t.prisma.post.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });

    const ranking = await explore(a.agent, 'sort=popular&limit=50');
    expect(ranking.items.map((item) => item.id)).toEqual([
      discussed.id, // 4
      liked.id, // 3
      reposted.id, // 1
      quiet.id, // 0
    ]);

    // Two at a time, the cursor carries the score: nothing repeats, nothing is skipped.
    const first = await explore(a.agent, 'sort=popular&limit=2');
    expect(first.items.map((item) => item.id)).toEqual([discussed.id, liked.id]);
    const second = await explore(
      a.agent,
      `sort=popular&limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    expect(second.items.map((item) => item.id)).toEqual([reposted.id, quiet.id]);
    expect(second.nextCursor).toBeNull();
  });

  it('requires a session and a known sort', async () => {
    await request(t.server).get('/api/v1/explore/posts').expect(401);
    const { agent } = await member();
    await agent.get('/api/v1/explore/posts?sort=random').expect(400);
  });
});
