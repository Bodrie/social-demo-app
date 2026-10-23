import { apiErrorSchema, postSchema, userPublicSchema } from '@beso/shared';
import { ACHIEVEMENTS } from '@beso/shared/achievements';
import request from 'supertest';
import { AchievementsService } from '../src/achievements/achievements.service.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

/** Plain badges, none of them a Collector tier, to give a member a count to collect. */
const PLAIN = ACHIEVEMENTS.filter((a) => a.series !== 'collected' && !a.hidden).map((a) => a.key);

describe('badge rewards', () => {
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
  const profile = async (agent: TestAgent, userId: string) =>
    userPublicSchema.parse((await agent.get(`/api/v1/users/${userId}`).expect(200)).body);
  const hold = (userId: string, keys: readonly string[]) =>
    t.prisma.userAchievement.createMany({
      data: keys.map((key) => ({ userId, key })),
      skipDuplicates: true,
    });
  const settings = (agent: TestAgent, body: object) =>
    agent.patch('/api/v1/users/me/settings').send(body).expect(200);

  beforeAll(async () => {
    t = await createTestApp();
    [alice, bob] = await Promise.all([createUser(t.prisma), createUser(t.prisma)]);
    [aliceAgent, bobAgent] = await Promise.all([agentFor(alice), agentFor(bob)]);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('put the Collector tier around the avatar, unless the member switches it or the badges off', async () => {
    expect((await profile(bobAgent, alice.id)).ring).toBeNull();
    await hold(alice.id, PLAIN.slice(0, 10));
    await t.app.get(AchievementsService).check(alice.id, ['collected']);
    expect((await profile(bobAgent, alice.id)).ring).toBe('bronze');

    // Every place a member appears carries it: a post's author, for one.
    const post = postSchema.parse(
      (await aliceAgent.post('/api/v1/posts').send({ content: 'Ringed' }).expect(201)).body,
    );
    expect(post.author.ring).toBe('bronze');

    await settings(aliceAgent, { showRing: false });
    expect((await profile(bobAgent, alice.id)).ring).toBeNull();
    await settings(aliceAgent, { showRing: true });
    expect((await profile(bobAgent, alice.id)).ring).toBe('bronze');
    await settings(aliceAgent, { showAchievements: false });
    expect((await profile(bobAgent, alice.id)).ring).toBeNull();
    await settings(aliceAgent, { showAchievements: true });

    await hold(alice.id, PLAIN.slice(10, 25));
    await t.app.get(AchievementsService).check(alice.id, ['collected']);
    expect((await profile(bobAgent, alice.id)).ring).toBe('silver');
  });

  it('feature up to three held badges under the name, hidden with the badges', async () => {
    await hold(bob.id, ['first-post', 'first-like', 'first-comment', 'first-repost']);
    const put = (keys: string[], status: number) =>
      bobAgent.put('/api/v1/users/me/featured-badges').send({ keys }).expect(status);

    await put(['first-like', 'first-post'], 204);
    expect((await profile(aliceAgent, bob.id)).featuredBadges).toEqual([
      'first-like',
      'first-post',
    ]);
    expect(apiErrorSchema.parse((await put(['pollster'], 400)).body).fields).toEqual({
      keys: 'Earn the badge first',
    });
    await put(['first-post', 'first-like', 'first-comment', 'first-repost'], 400);
    await put(['first-post', 'first-post'], 400);

    await settings(bobAgent, { showAchievements: false });
    expect((await profile(aliceAgent, bob.id)).featuredBadges).toEqual([]);
    await settings(bobAgent, { showAchievements: true });
    await put([], 204);
    expect((await profile(aliceAgent, bob.id)).featuredBadges).toEqual([]);
  });

  it('share a held badge as a post of its own', async () => {
    const share = (body: object) => bobAgent.post('/api/v1/posts').send(body);
    const shared = postSchema.parse(
      (await share({ content: 'Look what I got', achievementKey: 'first-post' }).expect(201)).body,
    );
    expect(shared.achievement).toBe('first-post');
    expect(
      apiErrorSchema.parse(
        (await share({ content: 'Not mine', achievementKey: 'pollster' }).expect(400)).body,
      ).fields,
    ).toEqual({ achievementKey: 'Not one of your badges' });
    const withPoll = await share({
      content: 'Both?',
      achievementKey: 'first-post',
      poll: { options: ['a', 'b'], duration: '1h' },
    }).expect(400);
    expect(Object.keys(apiErrorSchema.parse(withPoll.body).fields ?? {})).toContain(
      'achievementKey',
    );
  });
});
