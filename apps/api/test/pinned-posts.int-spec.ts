import { meResponseSchema, postSchema, userPublicSchema } from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

describe('pinned posts', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;

  const agentFor = async (user: CreatedUser): Promise<TestAgent> => {
    const agent = request.agent(t.server);
    await login(agent, user.email);
    return agent;
  };
  const publish = async (agent: TestAgent, content: string) =>
    postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body);
  const pinnedOf = async (agent: TestAgent, userId: string) =>
    userPublicSchema.parse((await agent.get(`/api/v1/users/${userId}`).expect(200)).body)
      .pinnedPostId;

  beforeAll(async () => {
    t = await createTestApp();
    [alice, bob] = await Promise.all([createUser(t.prisma), createUser(t.prisma)]);
    [aliceAgent, bobAgent] = await Promise.all([agentFor(alice), agentFor(bob)]);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('keep one post first on the author profile, replaced by the next pin', async () => {
    const [first, second] = [await publish(aliceAgent, 'Hello'), await publish(aliceAgent, 'Me')];
    expect(await pinnedOf(bobAgent, alice.id)).toBeNull();

    await aliceAgent.put(`/api/v1/posts/${first.id}/pin`).expect(204);
    expect(await pinnedOf(bobAgent, alice.id)).toBe(first.id);
    const me = meResponseSchema.parse((await aliceAgent.get('/api/v1/auth/me').expect(200)).body);
    expect(me.user.pinnedPostId).toBe(first.id);

    await aliceAgent.put(`/api/v1/posts/${second.id}/pin`).expect(204);
    expect(await pinnedOf(bobAgent, alice.id)).toBe(second.id);
    // Unpinning a post that is no longer the pinned one leaves the pin alone.
    await aliceAgent.delete(`/api/v1/posts/${first.id}/pin`).expect(204);
    expect(await pinnedOf(bobAgent, alice.id)).toBe(second.id);
    await aliceAgent.delete(`/api/v1/posts/${second.id}/pin`).expect(204);
    expect(await pinnedOf(bobAgent, alice.id)).toBeNull();
  });

  it('are the author’s alone, go with the post, and stay hidden across a block', async () => {
    const post = await publish(aliceAgent, 'Pin me');
    await bobAgent.put(`/api/v1/posts/${post.id}/pin`).expect(403);
    await bobAgent.put('/api/v1/posts/00000000-0000-7000-8000-000000000000/pin').expect(404);

    await aliceAgent.put(`/api/v1/posts/${post.id}/pin`).expect(204);
    await aliceAgent.put(`/api/v1/users/${bob.id}/block`).expect(204);
    expect(await pinnedOf(bobAgent, alice.id)).toBeNull();
    await aliceAgent.delete(`/api/v1/users/${bob.id}/block`).expect(204);
    expect(await pinnedOf(bobAgent, alice.id)).toBe(post.id);

    await aliceAgent.delete(`/api/v1/posts/${post.id}`).expect(204);
    expect(await pinnedOf(bobAgent, alice.id)).toBeNull();
  });
});
