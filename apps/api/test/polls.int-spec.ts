import { accountExportSchema, apiErrorSchema, postListSchema, postSchema } from '@beso/shared';
import { myAchievementsSchema } from '@beso/shared/achievements';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

const GHOST = '00000000-0000-7000-8000-000000000000';
const HOUR = 60 * 60 * 1000;

describe('polls', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let carol: CreatedUser;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;
  let carolAgent: TestAgent;

  const agentFor = async (user: CreatedUser): Promise<TestAgent> => {
    const agent = request.agent(t.server);
    await login(agent, user.email);
    return agent;
  };

  const ask = async (agent: TestAgent, options = ['Saturday', 'Sunday'], duration = '1d') =>
    postSchema.parse(
      (
        await agent
          .post('/api/v1/posts')
          .send({ content: 'Which day for the hike?', poll: { options, duration } })
          .expect(201)
      ).body,
    );

  const read = async (agent: TestAgent, postId: string) =>
    postSchema.parse((await agent.get(`/api/v1/posts/${postId}`).expect(200)).body);

  const vote = (agent: TestAgent, postId: string, optionId: string) =>
    agent.put(`/api/v1/posts/${postId}/poll/vote`).send({ optionId });

  const counts = (post: { poll: { options: { votes: number | null }[] } | null }) =>
    post.poll?.options.map((option) => option.votes);

  beforeAll(async () => {
    t = await createTestApp();
    [alice, bob, carol] = await Promise.all([
      createUser(t.prisma),
      createUser(t.prisma),
      createUser(t.prisma),
    ]);
    [aliceAgent, bobAgent, carolAgent] = await Promise.all([
      agentFor(alice),
      agentFor(bob),
      agentFor(carol),
    ]);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('are asked with a post, open for the chosen time, and fixed afterwards', async () => {
    const before = Date.now();
    const post = await ask(aliceAgent, [' Saturday ', 'Sunday', 'Either'], '3d');
    expect(post.poll).toMatchObject({
      options: [
        { text: 'Saturday', votes: 0 },
        { text: 'Sunday', votes: 0 },
        { text: 'Either', votes: 0 },
      ],
      totalVotes: 0,
      myVote: null,
      closed: false,
    });
    const closesIn = Date.parse(post.poll?.closesAt ?? '') - before;
    expect(closesIn).toBeGreaterThan(72 * HOUR - 60_000);
    expect(closesIn).toBeLessThan(72 * HOUR + 60_000);

    // The text can change; the poll stays as it was.
    const edited = postSchema.parse(
      (
        await aliceAgent
          .patch(`/api/v1/posts/${post.id}`)
          .send({ content: 'Which day? Last call' })
          .expect(200)
      ).body,
    );
    expect(edited.poll).toEqual(post.poll);

    // A quote names the poll without showing it.
    const quote = postSchema.parse(
      (
        await bobAgent
          .post('/api/v1/posts')
          .send({ content: 'Vote!', quotedPostId: post.id })
          .expect(201)
      ).body,
    );
    expect(quote.quotedPost).toMatchObject({ id: post.id, hasPoll: true });
    expect(quote.poll).toBeNull();
  });

  it('refuse a poll with pictures, in a quote, or with too few or repeated options', async () => {
    const original = await ask(aliceAgent);
    const field = async (body: object) => {
      const response = await aliceAgent.post('/api/v1/posts').send(body).expect(400);
      return Object.keys(apiErrorSchema.parse(response.body).fields ?? {});
    };
    const poll = { options: ['Yes', 'No'], duration: '1h' };
    expect(
      await field({
        content: 'x',
        poll,
        imageKeys: ['post/01a13ed6-d3ec-71cb-b39f-fbc256a293b1.webp'],
      }),
    ).toContain('poll');
    expect(await field({ content: 'x', poll, quotedPostId: original.id })).toContain('poll');
    expect(await field({ content: 'x', poll: { ...poll, options: ['Yes'] } })).toContain(
      'poll.options',
    );
    expect(await field({ content: 'x', poll: { ...poll, options: ['Yes', 'yes'] } })).toContain(
      'poll.options',
    );
    expect(await field({ content: 'x', poll: { ...poll, duration: '2d' } })).toContain(
      'poll.duration',
    );
  });

  it('take one final vote and show the results to voters, the author, and everyone at the close', async () => {
    const post = await ask(aliceAgent);
    const [saturday, sunday] = post.poll?.options ?? [];
    if (!saturday || !sunday) throw new Error('two options expected');

    // Before voting: how many voted, not for what.
    expect(counts(await read(bobAgent, post.id))).toEqual([null, null]);

    const voted = postSchema.parse((await vote(bobAgent, post.id, sunday.id).expect(200)).body);
    expect(voted.poll).toMatchObject({ myVote: sunday.id, totalVotes: 1 });
    expect(counts(voted)).toEqual([0, 1]);
    expect(
      apiErrorSchema.parse((await vote(bobAgent, post.id, saturday.id).expect(409)).body).message,
    ).toBe('You have voted in this poll already');

    const carolSees = await read(carolAgent, post.id);
    expect(carolSees.poll).toMatchObject({ totalVotes: 1, myVote: null });
    expect(counts(carolSees)).toEqual([null, null]);
    expect(counts(await read(aliceAgent, post.id))).toEqual([0, 1]);
    await vote(aliceAgent, post.id, saturday.id).expect(403);

    // Lists carry the same view as the post page.
    const feed = postListSchema.parse(
      (await bobAgent.get(`/api/v1/users/${alice.id}/posts`).expect(200)).body,
    );
    expect(counts(feed.items.find((item) => item.id === post.id) ?? { poll: null })).toEqual([
      0, 1,
    ]);

    await t.prisma.poll.update({
      where: { postId: post.id },
      data: { closesAt: new Date(Date.now() - 1000) },
    });
    const closed = await read(carolAgent, post.id);
    expect(closed.poll).toMatchObject({ closed: true, myVote: null });
    expect(counts(closed)).toEqual([0, 1]);
    expect(
      apiErrorSchema.parse((await vote(carolAgent, post.id, saturday.id).expect(409)).body).message,
    ).toBe('This poll has closed');
  });

  it('refuse a vote for an option elsewhere, on a post without a poll, and across a block', async () => {
    const [mine, other] = [await ask(aliceAgent), await ask(bobAgent)];
    const foreign = other.poll?.options[0]?.id ?? '';
    const wrong = await vote(carolAgent, mine.id, foreign).expect(400);
    expect(apiErrorSchema.parse(wrong.body).fields).toEqual({
      optionId: 'Not an option of this poll',
    });
    await vote(carolAgent, GHOST, foreign).expect(404);
    const plain = postSchema.parse(
      (await aliceAgent.post('/api/v1/posts').send({ content: 'No question' }).expect(201)).body,
    );
    await vote(carolAgent, plain.id, foreign).expect(404);

    await aliceAgent.put(`/api/v1/users/${carol.id}/block`).expect(204);
    const blocked = await vote(carolAgent, mine.id, mine.poll?.options[0]?.id ?? '').expect(403);
    expect(apiErrorSchema.parse(blocked.body).code).toBe('BLOCKED');
    await aliceAgent.delete(`/api/v1/users/${carol.id}/block`).expect(204);
  });

  it('count towards badges and leave with the export', async () => {
    const dave = await createUser(t.prisma);
    const daveAgent = await agentFor(dave);
    const post = await ask(daveAgent, ['Tea', 'Coffee']);
    await vote(bobAgent, post.id, post.poll?.options[1]?.id ?? '').expect(200);

    const progress = async (agent: TestAgent) =>
      myAchievementsSchema.parse(
        (await agent.get('/api/v1/users/me/achievements').expect(200)).body,
      );
    const daves = await progress(daveAgent);
    expect(daves.earned.map((badge) => badge.key)).toContain('first-poll');
    expect(daves.progress['top-poll-votes']).toBe(1);
    expect((await progress(bobAgent)).progress['poll-votes']).toBeGreaterThanOrEqual(1);

    const daveExport = accountExportSchema.parse(
      (await daveAgent.get('/api/v1/users/me/export').expect(200)).body,
    );
    expect(daveExport.posts.find((item) => item.id === post.id)?.poll).toMatchObject({
      options: [
        { text: 'Tea', votes: 0 },
        { text: 'Coffee', votes: 1 },
      ],
    });
    const bobExport = accountExportSchema.parse(
      (await bobAgent.get('/api/v1/users/me/export').expect(200)).body,
    );
    expect(bobExport.pollVotes).toContainEqual(
      expect.objectContaining({ postId: post.id, option: 'Coffee' }),
    );
  });
});
