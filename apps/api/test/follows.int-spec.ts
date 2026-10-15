import { apiErrorSchema, userListSchema, userPublicSchema } from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

const MISSING = '00000000-0000-7000-8000-000000000000';

describe('follows', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('follows and unfollows idempotently, updating counts and flags on both sides', async () => {
    const me = await createUser(t.prisma);
    const them = await createUser(t.prisma);
    const myAgent = await agentFor(t, me);
    const theirAgent = await agentFor(t, them);

    await myAgent.put(`/api/v1/users/${them.id}/follow`).expect(204);
    await myAgent.put(`/api/v1/users/${them.id}/follow`).expect(204);

    const theirProfile = userPublicSchema.parse((await myAgent.get(`/api/v1/users/${them.id}`).expect(200)).body);
    expect(theirProfile).toMatchObject({ followedByMe: true, followsMe: false, counts: { followers: 1, following: 0 } });
    const myProfileSeenByThem = userPublicSchema.parse((await theirAgent.get(`/api/v1/users/${me.id}`).expect(200)).body);
    expect(myProfileSeenByThem).toMatchObject({ followedByMe: false, followsMe: true, counts: { followers: 0, following: 1 } });

    await myAgent.delete(`/api/v1/users/${them.id}/follow`).expect(204);
    await myAgent.delete(`/api/v1/users/${them.id}/follow`).expect(204);

    const after = userPublicSchema.parse((await myAgent.get(`/api/v1/users/${them.id}`).expect(200)).body);
    expect(after).toMatchObject({ followedByMe: false, counts: { followers: 0 } });
  });

  it('refuses self-follow and unknown users', async () => {
    const me = await createUser(t.prisma);
    const myAgent = await agentFor(t, me);

    const self = await myAgent.put(`/api/v1/users/${me.id}/follow`).expect(400);
    expect(apiErrorSchema.parse(self.body).message).toBe('You cannot follow yourself');
    await myAgent.put(`/api/v1/users/${MISSING}/follow`).expect(404);
    await myAgent.delete(`/api/v1/users/${MISSING}/follow`).expect(404);
    await myAgent.get(`/api/v1/users/${MISSING}/followers`).expect(404);
    await request(t.server).put(`/api/v1/users/${me.id}/follow`).expect(401);
  });

  it('lists followers and following, most recent first, with cursor paging', async () => {
    const star = await createUser(t.prisma);
    const fans = [await createUser(t.prisma), await createUser(t.prisma), await createUser(t.prisma)];
    const starAgent = await agentFor(t, star);
    for (const fan of fans) {
      // oxlint-disable-next-line no-await-in-loop -- sequential so createdAt ordering is deterministic
      await (await agentFor(t, fan)).put(`/api/v1/users/${star.id}/follow`).expect(204);
    }

    const page1 = userListSchema.parse((await starAgent.get(`/api/v1/users/${star.id}/followers?limit=2`).expect(200)).body);
    expect(page1.items.map((u) => u.id)).toEqual([fans[2]!.id, fans[1]!.id]);
    expect(page1.items[0]).toMatchObject({ followsMe: true, followedByMe: false });
    expect(page1.nextCursor).not.toBeNull();

    const page2 = userListSchema.parse(
      (await starAgent.get(`/api/v1/users/${star.id}/followers?limit=2&cursor=${page1.nextCursor}`).expect(200)).body,
    );
    expect(page2.items.map((u) => u.id)).toEqual([fans[0]!.id]);
    expect(page2.nextCursor).toBeNull();

    const following = userListSchema.parse((await starAgent.get(`/api/v1/users/${fans[0]!.id}/following`).expect(200)).body);
    expect(following.items.map((u) => u.id)).toEqual([star.id]);
    expect(following.items[0]).toMatchObject({ followedByMe: false, followsMe: false });

    // The cursor still works after the row it points at disappears.
    await (await agentFor(t, fans[1]!)).delete(`/api/v1/users/${star.id}/follow`).expect(204);
    const afterUnfollow = userListSchema.parse(
      (await starAgent.get(`/api/v1/users/${star.id}/followers?limit=2&cursor=${page1.nextCursor}`).expect(200)).body,
    );
    expect(afterUnfollow.items.map((u) => u.id)).toEqual([fans[0]!.id]);
  });

  it('shows follow flags in search results and suggestions', async () => {
    const me = await createUser(t.prisma);
    const followed = await createUser(t.prisma, { username: 'flagged_user' });
    const myAgent = await agentFor(t, me);
    await myAgent.put(`/api/v1/users/${followed.id}/follow`).expect(204);

    const search = userListSchema.parse((await myAgent.get('/api/v1/users?q=flagged_user').expect(200)).body);
    expect(search.items[0]).toMatchObject({ id: followed.id, followedByMe: true });

    const suggestions = userListSchema.parse((await myAgent.get('/api/v1/users/suggestions?limit=20').expect(200)).body);
    expect(suggestions.items.map((u) => u.id)).not.toContain(followed.id);
  });
});
