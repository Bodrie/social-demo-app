import { apiErrorSchema, authResponseSchema, postSchema } from '@beso/shared';
import { achievementListSchema } from '@beso/shared/achievements';
import request from 'supertest';
import { AchievementsService } from '../src/achievements/achievements.service.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

const DAY = 24 * 60 * 60 * 1000;

/** The hidden badges and the time zone they read the clock in (F2b). */
describe('hidden achievements', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function member(timeZone?: string): Promise<{ user: CreatedUser; agent: TestAgent }> {
    const user = await createUser(t.prisma);
    if (timeZone) {
      await t.prisma.user.update({ where: { id: user.id }, data: { settings: { timeZone } } });
    }
    const agent = request.agent(t.server);
    await login(agent, user.email);
    return { user, agent };
  }

  const post = async (agent: TestAgent, content: string, quotedPostId?: string) =>
    postSchema.parse(
      (await agent.post('/api/v1/posts').send({ content, quotedPostId }).expect(201)).body,
    );

  const keysOf = async (userId: string): Promise<string[]> =>
    (await t.prisma.userAchievement.findMany({ where: { userId } })).map((row) => row.key);

  const backdate = (postId: string, createdAt: Date) =>
    t.prisma.post.update({ where: { id: postId }, data: { createdAt } });

  it('keeps a time zone among the settings, refusing names Intl does not know', async () => {
    const { agent } = await member();
    const patched = authResponseSchema.parse(
      (
        await agent
          .patch('/api/v1/users/me/settings')
          .send({ timeZone: 'Europe/Sofia' })
          .expect(200)
      ).body,
    );
    expect(patched.user.settings.timeZone).toBe('Europe/Sofia');

    const refused = await agent
      .patch('/api/v1/users/me/settings')
      .send({ timeZone: 'Moon/Tranquility' })
      .expect(400);
    expect(apiErrorSchema.parse(refused.body).fields).toHaveProperty('timeZone');

    const cleared = authResponseSchema.parse(
      (await agent.patch('/api/v1/users/me/settings').send({ timeZone: null }).expect(200)).body,
    );
    expect(cleared.user.settings.timeZone).toBeNull();
  });

  it('reads the clock in the member’s zone, and not at all without one', async () => {
    const sofia = await member('Europe/Sofia');
    const nowhere = await member();
    for (const someone of [sofia, nowhere]) {
      // oxlint-disable-next-line no-await-in-loop -- two members, same story
      const late = await post(someone.agent, 'Cannot sleep');
      // 01:30 UTC is 03:30 in Sofia in November, on a Friday the 13th.
      // oxlint-disable-next-line no-await-in-loop -- setup
      await backdate(late.id, new Date('2026-11-13T01:30:00Z'));
      // oxlint-disable-next-line no-await-in-loop -- the next post is what counts again
      await post(someone.agent, 'Morning');
    }
    expect(await keysOf(sofia.user.id)).toEqual(
      expect.arrayContaining(['night-owl', 'unlucky-for-some']),
    );
    const without = await keysOf(nowhere.user.id);
    expect(without).not.toContain('night-owl');
    expect(without).not.toContain('unlucky-for-some');
  });

  it('finds the words: emoji only, a palindrome, the full length, #beso and a kiss', async () => {
    const { user, agent } = await member();
    await post(agent, '🎉 🥳');
    await post(agent, 'Was it a car or a cat I saw?');
    await post(agent, 'x'.repeat(500));
    await post(agent, 'Hello #beso');
    expect(await keysOf(user.id)).toEqual(
      expect.arrayContaining(['speechless', 'racecar', 'to-the-letter', 'home-team']),
    );
    expect(await keysOf(user.id)).not.toContain('un-beso');

    const friend = await createUser(t.prisma);
    const thread = await agent.put(`/api/v1/conversations/direct/${friend.id}`).expect(200);
    await agent
      .post(`/api/v1/conversations/${(thread.body as { id: string }).id}/messages`)
      .send({ content: 'Night 😘' })
      .expect(201);
    expect(await keysOf(user.id)).toContain('un-beso');
  });

  it('notices timing: a quick reply, an old post, a return, a third edit', async () => {
    const { user, agent } = await member();
    const other = await member();
    const theirs = await post(other.agent, 'Anyone?');
    const comment = await other.agent
      .post(`/api/v1/posts/${theirs.id}/comments`)
      .send({ content: 'Hello?' })
      .expect(201);
    await agent
      .post(`/api/v1/posts/${theirs.id}/comments`)
      .send({ content: 'Here!', parentId: (comment.body as { id: string }).id })
      .expect(201);

    const ancient = await post(other.agent, 'From long ago');
    await backdate(ancient.id, new Date(Date.now() - 400 * DAY));
    await agent
      .post(`/api/v1/posts/${ancient.id}/comments`)
      .send({ content: 'Still true' })
      .expect(201);

    const earlier = await post(agent, 'Before the break');
    await backdate(earlier.id, new Date(Date.now() - 61 * DAY));
    const back = await post(agent, 'I am back');

    for (const content of ['I am back!', 'I am back!!', 'I am back.']) {
      // oxlint-disable-next-line no-await-in-loop -- three edits in order
      await agent.patch(`/api/v1/posts/${back.id}`).send({ content }).expect(200);
    }

    expect(await keysOf(user.id)).toEqual(
      expect.arrayContaining(['quick-draw', 'archaeologist', 'welcome-back', 'perfectionist']),
    );
  });

  it('notices quotes of quotes, replies to oneself and every reaction', async () => {
    const { user, agent } = await member();
    const other = await member();
    const original = await post(other.agent, 'The original');
    const quote = await post(other.agent, 'A quote', original.id);
    await post(agent, 'A quote of a quote', quote.id);

    const mine = await agent
      .post(`/api/v1/posts/${original.id}/comments`)
      .send({ content: 'I think…' })
      .expect(201);
    await agent
      .post(`/api/v1/posts/${original.id}/comments`)
      .send({ content: '…and also', parentId: (mine.body as { id: string }).id })
      .expect(201);

    const comments = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((content) =>
        t.prisma.comment.create({
          data: { postId: original.id, authorId: other.user.id, content },
        }),
      ),
    );
    const types = ['LIKE', 'LOVE', 'LAUGH', 'WOW'] as const;
    for (const [index, type] of types.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- one reaction each
      await agent
        .put(`/api/v1/comments/${comments[index]?.id}/reaction`)
        .send({ type })
        .expect(200);
    }
    expect(await keysOf(user.id)).not.toContain('full-range');
    // Switching the last one to the fifth kind completes the range.
    await agent.put(`/api/v1/comments/${comments[3]?.id}/reaction`).send({ type: 'SAD' });
    expect(await keysOf(user.id)).not.toContain('full-range');
    await agent.put(`/api/v1/comments/${comments[4]?.id}/reaction`).send({ type: 'WOW' });

    expect(await keysOf(user.id)).toEqual(
      expect.arrayContaining(['inception', 'talking-to-myself', 'full-range']),
    );
  });

  it('makes a Detective of whoever finds five, shown to others once found', async () => {
    const { user, agent } = await member();
    const viewer = await member();
    await post(agent, '🙂');
    await post(agent, 'Step on no pets, never.');
    await post(agent, 'x'.repeat(500));
    await post(agent, '#beso');
    expect(await keysOf(user.id)).not.toContain('detective');
    const earlier = await post(agent, 'Long ago');
    await backdate(earlier.id, new Date(Date.now() - 90 * DAY));
    await post(agent, 'Back again');

    expect(await keysOf(user.id)).toContain('detective');
    const shown = achievementListSchema.parse(
      (await viewer.agent.get(`/api/v1/users/${user.id}/achievements`).expect(200)).body,
    );
    expect(shown.items.map((item) => item.key)).toEqual(
      expect.arrayContaining(['speechless', 'detective']),
    );
  });

  it('leaves Around the clock to the daily sweep', async () => {
    const { user, agent } = await member('UTC');
    const day = new Date('2026-06-01T00:20:00Z').getTime();
    const posts = await Promise.all(
      Array.from({ length: 23 }, (_, hour) =>
        t.prisma.post.create({
          data: {
            authorId: user.id,
            content: `At ${hour}`,
            createdAt: new Date(day + hour * 3_600_000),
          },
        }),
      ),
    );
    expect(posts).toHaveLength(23);
    const sweep = t.app.get(AchievementsService);
    await sweep.sweep(new Date());
    expect(await keysOf(user.id)).not.toContain('around-the-clock');

    // The 24th hour arrives as a chat message.
    const friend = await createUser(t.prisma);
    const thread = await agent.put(`/api/v1/conversations/direct/${friend.id}`).expect(200);
    const sent = await agent
      .post(`/api/v1/conversations/${(thread.body as { id: string }).id}/messages`)
      .send({ content: 'Late' })
      .expect(201);
    await t.prisma.message.update({
      where: { id: (sent.body as { id: string }).id },
      data: { createdAt: new Date(day + 23 * 3_600_000) },
    });
    expect(await keysOf(user.id)).not.toContain('around-the-clock');
    await sweep.sweep(new Date());
    expect(await keysOf(user.id)).toContain('around-the-clock');
  });
});
