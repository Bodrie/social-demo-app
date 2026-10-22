import { inviteSchema, postSchema } from '@beso/shared';
import { myAchievementsSchema } from '@beso/shared/achievements';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';
import { tokenIn, waitForEmail } from './setup/outbox.js';

/** Recognition and Community (F2b): badges that depend on what others do. */
describe('achievements that need other people', () => {
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

  /** Members who only exist to have done something, written straight into the tables. */
  const crowd = async (size: number): Promise<CreatedUser[]> => {
    const users: CreatedUser[] = [];
    for (let index = 0; index < size; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- a few rows of setup
      users.push(await createUser(t.prisma));
    }
    return users;
  };

  const post = async (agent: TestAgent, content: string) =>
    postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body);

  const keysOf = async (userId: string): Promise<string[]> =>
    (await t.prisma.userAchievement.findMany({ where: { userId } })).map((row) => row.key);

  const badgeNotes = async (userId: string): Promise<(string | null)[]> =>
    (
      await t.prisma.notification.findMany({
        where: { userId, type: 'ACHIEVEMENT_EARNED' },
        orderBy: { createdAt: 'asc' },
      })
    ).map((row) => row.achievementKey);

  it('recognises likes: ten on one post are a Hit and ten received are Loved', async () => {
    const author = await member();
    const fan = await member();
    const liked = await post(author.agent, 'Like me');
    const others = await crowd(9);
    await t.prisma.postLike.createMany({
      data: others.map((user) => ({ userId: user.id, postId: liked.id })),
    });

    // The tenth like comes through the API, which is what checks the author.
    await fan.agent.put(`/api/v1/posts/${liked.id}/like`).expect(204);

    expect(await keysOf(author.user.id)).toEqual(
      expect.arrayContaining(['likes-received-10', 'top-post-likes-10']),
    );
    expect(await badgeNotes(author.user.id)).toEqual(
      expect.arrayContaining(['likes-received-10', 'top-post-likes-10']),
    );
  });

  it('recognises followers, comments from others, reactions, reposts and mentions', async () => {
    const author = await member();
    const fan = await member();
    const others = await crowd(9);
    const popular = await post(author.agent, 'Talk to me');

    await t.prisma.follow.createMany({
      data: others.map((user) => ({ followerId: user.id, followeeId: author.user.id })),
    });
    await fan.agent.put(`/api/v1/users/${author.user.id}/follow`).expect(204);

    // The author's own comments do not make a conversation.
    await t.prisma.comment.createMany({
      data: [
        ...others.map((user) => ({ postId: popular.id, authorId: user.id, content: 'Yes' })),
        { postId: popular.id, authorId: author.user.id, content: 'Thanks' },
      ],
    });
    const comment = await author.agent
      .post(`/api/v1/posts/${popular.id}/comments`)
      .send({ content: 'Thanks again' })
      .expect(201);
    expect(await keysOf(author.user.id)).not.toContain('top-post-comments-10');
    await fan.agent
      .post(`/api/v1/posts/${popular.id}/comments`)
      .send({ content: 'Me too' })
      .expect(201);

    await t.prisma.comment.update({
      where: { id: (comment.body as { id: string }).id },
      data: { reactionsCount: 9 },
    });
    await fan.agent
      .put(`/api/v1/comments/${(comment.body as { id: string }).id}/reaction`)
      .send({ type: 'LOVE' })
      .expect(200);

    await t.prisma.post.update({ where: { id: popular.id }, data: { repostCount: 4 } });
    await fan.agent.put(`/api/v1/posts/${popular.id}/repost`).expect(204);

    // Nine mentions from nine members, then the tenth.
    const mentions = await Promise.all(
      others.map((user) =>
        t.prisma.post.create({ data: { authorId: user.id, content: '@someone' } }),
      ),
    );
    await t.prisma.postMention.createMany({
      data: mentions.map((row) => ({ postId: row.id, userId: author.user.id })),
    });
    await post(fan.agent, `Hello @${author.user.username}`);

    expect(await keysOf(author.user.id)).toEqual(
      expect.arrayContaining([
        'followers-10',
        'top-post-comments-10',
        'crowd-favourite',
        'top-post-reposts-5',
        'talk-of-the-town',
      ]),
    );
  });

  it('makes the first to use a tag a Trendsetter once five others used it', async () => {
    const pioneer = await member();
    const latecomer = await member();
    const first = await post(pioneer.agent, 'Starting #freshidea');
    const others = await crowd(4);
    for (const user of others) {
      // oxlint-disable-next-line no-await-in-loop -- later than the first one, in order
      const later = await t.prisma.post.create({
        data: { authorId: user.id, content: '#freshidea' },
      });
      // oxlint-disable-next-line no-await-in-loop -- setup
      await t.prisma.postHashtag.create({
        data: { postId: later.id, tag: 'freshidea', createdAt: later.createdAt },
      });
    }
    expect(await keysOf(pioneer.user.id)).not.toContain('trendsetter');

    await post(latecomer.agent, 'Me too #freshidea');
    expect(await keysOf(pioneer.user.id)).toContain('trendsetter');
    expect(await keysOf(latecomer.user.id)).not.toContain('trendsetter');
    expect(first.hashtags).toEqual(['freshidea']);
  });

  it('welcomes newcomers, answers first and follows back', async () => {
    const regular = await member();
    const newcomer = await member();
    const veteran = await member();
    await t.prisma.user.update({
      where: { id: veteran.user.id },
      data: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    const fresh = await post(newcomer.agent, 'My first post');
    const old = await post(veteran.agent, 'An old hand');

    // Second on the newcomer's post: not the first response.
    await veteran.agent
      .post(`/api/v1/posts/${fresh.id}/comments`)
      .send({ content: 'Hi!' })
      .expect(201);
    await regular.agent
      .post(`/api/v1/posts/${fresh.id}/comments`)
      .send({ content: 'Welcome!' })
      .expect(201);
    await regular.agent.put(`/api/v1/users/${veteran.user.id}/follow`).expect(204);
    await regular.agent
      .post(`/api/v1/posts/${old.id}/comments`)
      .send({ content: 'First!' })
      .expect(201);
    const regularKeys = await keysOf(regular.user.id);
    // Only the newcomer was in their first week; only the veteran's post was answered first.
    expect(regularKeys).toEqual(
      expect.arrayContaining(['newcomers-welcomed-1', 'first-responses-1']),
    );
    expect(regularKeys).not.toContain('newcomers-welcomed-5');

    const friends = await crowd(5);
    await t.prisma.follow.createMany({
      data: friends.flatMap((user, index) => [
        { followerId: user.id, followeeId: regular.user.id },
        ...(index < 4 ? [{ followerId: regular.user.id, followeeId: user.id }] : []),
      ]),
    });
    expect(await keysOf(regular.user.id)).not.toContain('mutual-follows-5');
    await regular.agent.put(`/api/v1/users/${friends[4]?.id ?? ''}/follow`).expect(204);
    expect(await keysOf(regular.user.id)).toContain('mutual-follows-5');
  });

  it('counts a group’s size for its creator (Crew) and its members (Big table)', async () => {
    const host = await member();
    const guests = await crowd(9);
    const small = await host.agent
      .post('/api/v1/conversations')
      .send({ title: 'Four of us', memberIds: guests.slice(0, 3).map((user) => user.id) })
      .expect(201);
    expect(await keysOf(host.user.id)).not.toContain('crew');

    await host.agent
      .post(`/api/v1/conversations/${(small.body as { id: string }).id}/members`)
      .send({ userIds: [guests[3]?.id] })
      .expect(200);
    expect(await keysOf(host.user.id)).toContain('crew');
    expect(await keysOf(host.user.id)).not.toContain('big-table');

    await host.agent
      .post('/api/v1/conversations')
      .send({ title: 'Everyone', memberIds: guests.map((user) => user.id) })
      .expect(201);
    // Everyone at a table of ten; Crew stays the creator's.
    expect(await keysOf(host.user.id)).toContain('big-table');
    expect(await keysOf(guests[8]?.id ?? '')).toEqual(['big-table']);
  });

  it('counts the members who joined through an invite once they confirm', async () => {
    const inviter = await member();
    const { code } = inviteSchema.parse(
      (await inviter.agent.get('/api/v1/invites/me').expect(200)).body,
    );
    const email = `recruit-${Date.now()}@example.com`;
    const newcomer = request.agent(t.server);
    await newcomer
      .post('/api/v1/auth/register')
      .send({
        email,
        username: `recruit_${Date.now() % 100000}`,
        name: 'New Recruit',
        password: 'Password123!',
        inviteCode: code,
      })
      .expect(201);
    expect(await keysOf(inviter.user.id)).not.toContain('recruits-1');

    await newcomer
      .post('/api/v1/auth/verify-email')
      .send({ token: tokenIn(await waitForEmail(email, /Confirm/)) })
      .expect(200);
    expect(await keysOf(inviter.user.id)).toContain('recruits-1');
    expect(await badgeNotes(inviter.user.id)).toContain('recruits-1');
  });

  it('shows progress for these series, never for the hidden ones', async () => {
    const { agent } = await member();
    const { progress } = myAchievementsSchema.parse(
      (await agent.get('/api/v1/users/me/achievements').expect(200)).body,
    );
    expect(progress).toMatchObject({ followers: 0, 'likes-received': 0, crew: 0 });
    expect(progress).not.toHaveProperty('night-owl');
    expect(progress).not.toHaveProperty('palindrome');
  });
});
