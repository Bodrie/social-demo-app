import {
  type Notification,
  accountExportSchema,
  notificationListSchema,
  postSchema,
  uploadResponseSchema,
} from '@beso/shared';
import {
  ACHIEVEMENT_BY_KEY,
  achievementListSchema,
  achievementStatsSchema,
  myAchievementsSchema,
} from '@beso/shared/achievements';
import sharp from 'sharp';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

describe('achievements', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function member(
    overrides: Parameters<typeof createUser>[1] = {},
  ): Promise<{ user: CreatedUser; agent: TestAgent }> {
    const user = await createUser(t.prisma, overrides);
    const agent = request.agent(t.server);
    await login(agent, user.email);
    return { user, agent };
  }

  const post = async (agent: TestAgent, content: string) =>
    postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body);

  const mine = async (agent: TestAgent) =>
    myAchievementsSchema.parse((await agent.get('/api/v1/users/me/achievements').expect(200)).body);

  const theirs = async (agent: TestAgent, userId: string) =>
    achievementListSchema.parse(
      (await agent.get(`/api/v1/users/${userId}/achievements`).expect(200)).body,
    ).items;

  const badgeNotifications = async (agent: TestAgent): Promise<Notification[]> =>
    notificationListSchema
      .parse((await agent.get('/api/v1/notifications?limit=50').expect(200)).body)
      .items.filter((n) => n.type === 'ACHIEVEMENT_EARNED');

  const keysOf = (rows: readonly { key: string }[]) => rows.map((row) => row.key).toSorted();

  async function upload(agent: TestAgent, kind: 'avatar' | 'cover'): Promise<string> {
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#555' },
    })
      .png()
      .toBuffer();
    const response = await agent
      .post(`/api/v1/uploads?kind=${kind}`)
      .attach('file', image, `${kind}.png`)
      .expect(201);
    return uploadResponseSchema.parse(response.body).key;
  }

  it('awards a first post once, with a notification that has no actor', async () => {
    const { agent } = await member();
    const first = await post(agent, 'Hello, world');
    await post(agent, 'And again');

    const earned = await mine(agent);
    expect(keysOf(earned.earned)).toEqual(['first-post']);
    expect(earned.progress).toMatchObject({ posts: 2, comments: 0, 'getting-started': 1 });

    const [notification, ...rest] = await badgeNotifications(agent);
    expect(rest).toEqual([]);
    expect(notification).toMatchObject({
      actor: null,
      achievementKey: 'first-post',
      post: null,
      readAt: null,
    });
    // Unread like any other, and the bell counts it.
    const unread = await agent.get('/api/v1/notifications/unread-count').expect(200);
    expect(unread.body).toEqual({ count: 1 });

    // Earned is earned: deleting the posts takes nothing back.
    await agent.delete(`/api/v1/posts/${first.id}`).expect(204);
    expect(keysOf((await mine(agent)).earned)).toEqual(['first-post']);
  });

  it('climbs the tiers by counting what is there', async () => {
    const { user, agent } = await member();
    await t.prisma.post.createMany({
      data: Array.from({ length: 9 }, (_, index) => ({ authorId: user.id, content: `#${index}` })),
    });
    await post(agent, 'The tenth');

    expect(keysOf((await mine(agent)).earned)).toEqual(['first-post', 'posts-10']);
    expect((await badgeNotifications(agent)).map((n) => n.achievementKey)).toEqual([
      'posts-10',
      'first-post',
    ]);
  });

  it('finishes Getting started with "All set", and Firsts along the way', async () => {
    const { agent } = await member();
    const others = [await member(), await member(), await member()];
    const avatarKey = await upload(agent, 'avatar');
    const coverKey = await upload(agent, 'cover');
    await agent
      .patch('/api/v1/users/me')
      .send({ avatarKey, coverKey, bio: 'Hi there', city: 'Sofia', website: 'https://example.com' })
      .expect(200);
    for (const other of others) {
      // oxlint-disable-next-line no-await-in-loop -- three follows in order
      await agent.put(`/api/v1/users/${other.user.id}/follow`).expect(204);
    }
    const theirPost = await post(others[0]?.agent ?? agent, 'Say something');
    await agent.put(`/api/v1/posts/${theirPost.id}/like`).expect(204);
    await agent.put(`/api/v1/posts/${theirPost.id}/bookmark`).expect(204);
    await agent
      .post(`/api/v1/posts/${theirPost.id}/comments`)
      .send({ content: 'Nice' })
      .expect(201);
    await post(agent, 'My first #post');

    const { earned, progress } = await mine(agent);
    expect(keysOf(earned)).toEqual(
      [
        'profile-picture',
        'cover-photo',
        'bio',
        'full-profile',
        'follow-3',
        'first-like',
        'first-bookmark',
        'first-comment',
        'first-post',
        'first-hashtag',
        'all-set',
        // The eleven above tip Collector's first tier.
        'collected-10',
      ].toSorted(),
    );
    expect(progress).toMatchObject({ following: 3, 'getting-started': 6, collected: 12 });
    expect(await badgeNotifications(agent)).toHaveLength(12);
  });

  it('counts an account from before achievements silently the first time', async () => {
    const { user, agent } = await member();
    await t.prisma.post.createMany({
      data: Array.from({ length: 12 }, (_, index) => ({ authorId: user.id, content: `${index}` })),
    });
    await t.prisma.user.update({ where: { id: user.id }, data: { achievementsCheckedAt: null } });
    const other = await member();
    const theirPost = await post(other.agent, 'Like me');

    // The first event of the member backfills: the posts' badges arrive without a word.
    await agent.put(`/api/v1/posts/${theirPost.id}/like`).expect(204);
    // Tenure is counted too (Pioneer before the opening day); this test is about the rest.
    const earned = (await mine(agent)).earned.filter(
      (row) => ACHIEVEMENT_BY_KEY.get(row.key)?.group !== 'tenure',
    );
    expect(keysOf(earned)).toEqual(['first-like', 'first-post', 'posts-10']);
    expect(await badgeNotifications(agent)).toEqual([]);
    const row = await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.achievementsCheckedAt).not.toBeNull();

    // From then on, new badges are announced.
    await agent.put(`/api/v1/users/${other.user.id}/follow`).expect(204);
    await agent
      .post(`/api/v1/posts/${theirPost.id}/comments`)
      .send({ content: 'First words' })
      .expect(201);
    expect((await badgeNotifications(agent)).map((n) => n.achievementKey)).toEqual([
      'first-comment',
    ]);
  });

  it('shows a member’s badges to others unless hidden, never across a block', async () => {
    const owner = await member();
    const viewer = await member();
    await post(owner.agent, 'Something');
    expect(keysOf(await theirs(viewer.agent, owner.user.id))).toEqual(['first-post']);

    await owner.agent
      .patch('/api/v1/users/me/settings')
      .send({ showAchievements: false })
      .expect(200);
    expect(await theirs(viewer.agent, owner.user.id)).toEqual([]);
    // Hidden from everyone but the member.
    expect(keysOf(await theirs(owner.agent, owner.user.id))).toEqual(['first-post']);

    await owner.agent
      .patch('/api/v1/users/me/settings')
      .send({ showAchievements: true })
      .expect(200);
    await owner.agent.put(`/api/v1/users/${viewer.user.id}/block`).expect(204);
    expect(await theirs(viewer.agent, owner.user.id)).toEqual([]);

    await viewer.agent
      .get('/api/v1/users/0199b6a0-0000-7000-8000-000000000000/achievements')
      .expect(404);
  });

  it('counts chat: messages, reactions and groups', async () => {
    const { agent } = await member();
    const friend = await member();
    const group = await agent
      .post('/api/v1/conversations')
      .send({ title: 'Plans', memberIds: [friend.user.id] })
      .expect(201);
    const conversationId = (group.body as { id: string }).id;
    const sent = await friend.agent
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .send({ content: 'Hello' })
      .expect(201);
    await agent
      .put(
        `/api/v1/conversations/${conversationId}/messages/${(sent.body as { id: string }).id}/reaction`,
      )
      .send({ type: 'LOVE' })
      .expect(200);
    await agent
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .send({ content: 'Hi!' })
      .expect(201);

    expect(keysOf((await mine(agent)).earned)).toEqual([
      'first-group',
      'first-message',
      'first-reaction',
    ]);
    // A group's system line is not a message of anyone's.
    expect(keysOf((await mine(friend.agent)).earned)).toEqual(['first-message']);
  });

  it('tells how many members hold each badge, and the export lists them', async () => {
    const { agent } = await member();
    await post(agent, 'For the stats');
    const stats = achievementStatsSchema.parse(
      (await agent.get('/api/v1/achievements/stats').expect(200)).body,
    );
    expect(stats.members).toBeGreaterThan(0);
    expect(stats.items.find((item) => item.key === 'first-post')?.holders).toBeGreaterThan(0);

    const exported = accountExportSchema.parse(
      (await agent.get('/api/v1/users/me/export').expect(200)).body,
    );
    expect(exported.achievements).toEqual([
      { key: 'first-post', title: 'Hello, world', earnedAt: expect.any(String) },
    ]);
  });
});
