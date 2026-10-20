import { activityListSchema, commentSchema, postSchema, uploadResponseSchema } from '@beso/shared';
import sharp from 'sharp';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

async function feed(
  agent: TestAgent,
  query = '',
): Promise<ReturnType<typeof activityListSchema.parse>> {
  return activityListSchema.parse((await agent.get(`/api/v1/activities${query}`).expect(200)).body);
}

describe('activities', () => {
  let t: TestApp;
  let me: CreatedUser;
  let friend: CreatedUser;
  let stranger: CreatedUser;
  let myAgent: TestAgent;
  let friendAgent: TestAgent;
  let strangerAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    me = await createUser(t.prisma);
    friend = await createUser(t.prisma);
    stranger = await createUser(t.prisma);
    myAgent = await agentFor(t, me);
    friendAgent = await agentFor(t, friend);
    strangerAgent = await agentFor(t, stranger);
    await myAgent.put(`/api/v1/users/${friend.id}/follow`).expect(204);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('shows what followed users do, newest first, and nothing from strangers or myself', async () => {
    const strangerPost = postSchema.parse(
      (await strangerAgent.post('/api/v1/posts').send({ content: 'stranger post' }).expect(201))
        .body,
    );
    await myAgent.post('/api/v1/posts').send({ content: 'my own post' }).expect(201);

    const friendPost = postSchema.parse(
      (
        await friendAgent
          .post('/api/v1/posts')
          .send({
            content:
              'A long friendly post that goes on and on and on and on and on and on and on and on and on',
          })
          .expect(201)
      ).body,
    );
    const comment = commentSchema.parse(
      (
        await friendAgent
          .post(`/api/v1/posts/${strangerPost.id}/comments`)
          .send({ content: 'nice one' })
          .expect(201)
      ).body,
    );
    await friendAgent.put(`/api/v1/posts/${strangerPost.id}/like`).expect(204);
    await friendAgent.put(`/api/v1/users/${stranger.id}/follow`).expect(204);

    const activities = await feed(myAgent);
    expect(activities.items.map((a) => a.type)).toEqual([
      'USER_FOLLOWED',
      'POST_LIKED',
      'COMMENT_CREATED',
      'POST_CREATED',
    ]);
    expect(activities.items.every((a) => a.actor.id === friend.id)).toBe(true);

    const [followed, liked, commented, created] = activities.items;
    expect(followed?.targetUser).toMatchObject({ id: stranger.id, username: stranger.username });
    expect(liked?.post).toMatchObject({ id: strangerPost.id, excerpt: 'stranger post' });
    expect(commented?.comment).toMatchObject({ id: comment.id, excerpt: 'nice one' });
    expect(created?.post?.id).toBe(friendPost.id);
    expect(created?.post?.excerpt.endsWith('…')).toBe(true);
    expect(created?.post?.excerpt).toHaveLength(80);
  });

  it('pages with a cursor', async () => {
    const page1 = await feed(myAgent, '?limit=3');
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await feed(myAgent, `?limit=3&cursor=${page1.nextCursor}`);
    expect(page2.items).toHaveLength(1);
    expect(new Set([...page1.items, ...page2.items].map((a) => a.id)).size).toBe(
      page1.items.length + page2.items.length,
    );
  });

  it('drops like and follow entries when they are undone, and post entries when the post is deleted', async () => {
    const before = (await feed(myAgent)).items;
    const likeEntry = before.find((a) => a.type === 'POST_LIKED');
    const followEntry = before.find((a) => a.type === 'USER_FOLLOWED');
    const postEntry = before.find((a) => a.type === 'POST_CREATED');
    expect(likeEntry && followEntry && postEntry).toBeTruthy();

    await friendAgent.delete(`/api/v1/posts/${likeEntry?.post?.id}/like`).expect(204);
    await friendAgent.delete(`/api/v1/users/${followEntry?.targetUser?.id}/follow`).expect(204);
    await friendAgent.delete(`/api/v1/posts/${postEntry?.post?.id}`).expect(204);

    const after = (await feed(myAgent)).items.map((a) => a.type);
    expect(after).not.toContain('POST_LIKED');
    expect(after).not.toContain('USER_FOLLOWED');
    expect(after).not.toContain('POST_CREATED');
    expect(after).toContain('COMMENT_CREATED');
  });

  it('records registrations and picture updates', async () => {
    const newcomer = await request(t.server)
      .post('/api/v1/auth/register')
      .send({
        email: 'newcomer@example.com',
        username: 'newcomer',
        name: 'New',
        password: 'Password123!',
      })
      .expect(201);
    const newcomerId = newcomer.body.user.id as string;
    await myAgent.put(`/api/v1/users/${newcomerId}/follow`).expect(204);

    const types = (await feed(myAgent)).items
      .filter((a) => a.actor.id === newcomerId)
      .map((a) => a.type);
    expect(types).toEqual(['USER_REGISTERED']);

    // Changing the avatar is an activity; re-sending the same key or editing the bio is not.
    // (The newcomer confirms their address first; the app is closed until then.)
    await t.prisma.user.update({
      where: { id: newcomerId },
      data: { emailVerifiedAt: new Date() },
    });
    const newcomerAgent = request.agent(t.server);
    await newcomerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'newcomer@example.com', password: 'Password123!' })
      .expect(200);
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    const avatar = uploadResponseSchema.parse(
      (
        await newcomerAgent
          .post('/api/v1/uploads?kind=avatar')
          .attach('file', image, 'a.png')
          .expect(201)
      ).body,
    );
    await newcomerAgent.patch('/api/v1/users/me').send({ avatarKey: avatar.key }).expect(200);
    await newcomerAgent
      .patch('/api/v1/users/me')
      .send({ avatarKey: avatar.key, bio: 'hello' })
      .expect(200);

    const after = (await feed(myAgent)).items
      .filter((a) => a.actor.id === newcomerId)
      .map((a) => a.type);
    expect(after).toEqual(['PROFILE_UPDATED', 'USER_REGISTERED']);
  });

  it('requires a session', async () => {
    await request(t.server).get('/api/v1/activities').expect(401);
  });
});
