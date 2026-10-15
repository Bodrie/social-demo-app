import { apiErrorSchema, postListSchema, postSchema, uploadResponseSchema } from '@the-mesh/shared';
import sharp from 'sharp';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { resetDatabase } from './setup/database.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

async function createPost(agent: TestAgent, content: string): Promise<string> {
  const response = await agent.post('/api/v1/posts').send({ content }).expect(201);
  return postSchema.parse(response.body).id;
}

describe('posts', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('POST /posts', () => {
    it('creates a post with an uploaded image and returns the feed shape', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const image = await sharp({
        create: { width: 640, height: 480, channels: 3, background: '#224466' },
      })
        .png()
        .toBuffer();
      const upload = uploadResponseSchema.parse(
        (await agent.post('/api/v1/uploads?kind=post').attach('file', image, 'pic.png').expect(201))
          .body,
      );

      const response = await agent
        .post('/api/v1/posts')
        .send({ content: '  First!  ', imageKey: upload.key })
        .expect(201);
      const post = postSchema.parse(response.body);

      expect(post).toMatchObject({
        content: 'First!',
        imageUrl: upload.url,
        likeCount: 0,
        commentCount: 0,
        likedByMe: false,
        author: { id: me.id, username: me.username },
      });
    });

    it('validates content and image keys', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);

      const empty = await agent.post('/api/v1/posts').send({ content: '   ' }).expect(400);
      expect(apiErrorSchema.parse(empty.body).fields).toHaveProperty('content');

      const tooLong = await agent
        .post('/api/v1/posts')
        .send({ content: 'x'.repeat(501) })
        .expect(400);
      expect(apiErrorSchema.parse(tooLong.body).fields).toHaveProperty('content');

      const wrongKind = await agent
        .post('/api/v1/posts')
        .send({ content: 'pic', imageKey: 'avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp' })
        .expect(400);
      expect(apiErrorSchema.parse(wrongKind.body).fields).toHaveProperty('imageKey');

      const unknown = await agent
        .post('/api/v1/posts')
        .send({ content: 'pic', imageKey: 'post/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp' })
        .expect(400);
      expect(apiErrorSchema.parse(unknown.body).fields).toEqual({ imageKey: 'Unknown upload' });
    });

    it('requires a session', async () => {
      await request(t.server).post('/api/v1/posts').send({ content: 'hi' }).expect(401);
    });
  });

  describe('GET /posts (feed) and GET /users/:id/posts', () => {
    let me: CreatedUser;
    let followed: CreatedUser;
    let stranger: CreatedUser;
    let agent: TestAgent;
    let ids: { mine: string; followedOld: string; followedNew: string; stranger: string };

    beforeAll(async () => {
      await resetDatabase(t.prisma);
      me = await createUser(t.prisma);
      followed = await createUser(t.prisma);
      stranger = await createUser(t.prisma);
      await t.prisma.follow.create({ data: { followerId: me.id, followeeId: followed.id } });
      agent = await agentFor(t, me);
      const followedAgent = await agentFor(t, followed);
      const strangerAgent = await agentFor(t, stranger);

      const followedOld = await createPost(followedAgent, 'followed old');
      const mine = await createPost(agent, 'mine');
      const strangerPost = await createPost(strangerAgent, 'stranger');
      const followedNew = await createPost(followedAgent, 'followed new');
      ids = { mine, followedOld, followedNew, stranger: strangerPost };
    });

    it('shows own posts and followed authors, newest first, and excludes strangers', async () => {
      const feed = postListSchema.parse((await agent.get('/api/v1/posts').expect(200)).body);

      expect(feed.items.map((p) => p.id)).toEqual([ids.followedNew, ids.mine, ids.followedOld]);
      expect(feed.nextCursor).toBeNull();
    });

    it('pages through the feed with an opaque cursor', async () => {
      const first = postListSchema.parse(
        (await agent.get('/api/v1/posts?limit=2').expect(200)).body,
      );
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();

      const second = postListSchema.parse(
        (await agent.get(`/api/v1/posts?limit=2&cursor=${first.nextCursor}`).expect(200)).body,
      );
      expect(second.items.map((p) => p.id)).toEqual([ids.followedOld]);
      expect(second.nextCursor).toBeNull();
    });

    it('lists a single author’s posts, including strangers, and 404s on unknown authors', async () => {
      const list = postListSchema.parse(
        (await agent.get(`/api/v1/users/${stranger.id}/posts`).expect(200)).body,
      );
      expect(list.items.map((p) => p.id)).toEqual([ids.stranger]);
      await agent.get('/api/v1/users/00000000-0000-7000-8000-000000000000/posts').expect(404);
    });

    it('keeps paging correctly when the cursor row was deleted in between', async () => {
      const first = postListSchema.parse(
        (await agent.get('/api/v1/posts?limit=1').expect(200)).body,
      );
      expect(first.items.map((p) => p.id)).toEqual([ids.followedNew]);
      await t.prisma.post.delete({ where: { id: ids.followedNew } });

      const second = postListSchema.parse(
        (await agent.get(`/api/v1/posts?limit=5&cursor=${first.nextCursor}`).expect(200)).body,
      );
      expect(second.items.map((p) => p.id)).toEqual([ids.mine, ids.followedOld]);
    });

    it('fetches a single post and 404s on unknown ids', async () => {
      const post = postSchema.parse(
        (await agent.get(`/api/v1/posts/${ids.stranger}`).expect(200)).body,
      );
      expect(post.author.id).toBe(stranger.id);
      await agent.get('/api/v1/posts/00000000-0000-7000-8000-000000000000').expect(404);
      await agent.get('/api/v1/posts/not-a-uuid').expect(400);
    });
  });

  describe('likes', () => {
    it('are idempotent and visible per viewer', async () => {
      const author = await createUser(t.prisma);
      const fan = await createUser(t.prisma);
      const authorAgent = await agentFor(t, author);
      const fanAgent = await agentFor(t, fan);
      const postId = await createPost(authorAgent, 'like me');

      await fanAgent.put(`/api/v1/posts/${postId}/like`).expect(204);
      await fanAgent.put(`/api/v1/posts/${postId}/like`).expect(204);

      const fanView = postSchema.parse(
        (await fanAgent.get(`/api/v1/posts/${postId}`).expect(200)).body,
      );
      expect(fanView).toMatchObject({ likeCount: 1, likedByMe: true });
      const authorView = postSchema.parse(
        (await authorAgent.get(`/api/v1/posts/${postId}`).expect(200)).body,
      );
      expect(authorView).toMatchObject({ likeCount: 1, likedByMe: false });

      await fanAgent.delete(`/api/v1/posts/${postId}/like`).expect(204);
      await fanAgent.delete(`/api/v1/posts/${postId}/like`).expect(204);
      expect(
        postSchema.parse((await fanAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
          .likeCount,
      ).toBe(0);
    });

    it('404 on unknown posts', async () => {
      const fan = await createUser(t.prisma);
      const fanAgent = await agentFor(t, fan);
      await fanAgent.put('/api/v1/posts/00000000-0000-7000-8000-000000000000/like').expect(404);
      await fanAgent.delete('/api/v1/posts/00000000-0000-7000-8000-000000000000/like').expect(404);
    });
  });

  describe('DELETE /posts/:id', () => {
    it('lets only the author delete, and removes the image file', async () => {
      const author = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const authorAgent = await agentFor(t, author);
      const otherAgent = await agentFor(t, other);
      const image = await sharp({
        create: { width: 320, height: 240, channels: 3, background: '#aa2244' },
      })
        .png()
        .toBuffer();
      const upload = uploadResponseSchema.parse(
        (
          await authorAgent
            .post('/api/v1/uploads?kind=post')
            .attach('file', image, 'pic.png')
            .expect(201)
        ).body,
      );
      const postId = postSchema.parse(
        (
          await authorAgent
            .post('/api/v1/posts')
            .send({ content: 'bye', imageKey: upload.key })
            .expect(201)
        ).body,
      ).id;

      const forbidden = await otherAgent.delete(`/api/v1/posts/${postId}`).expect(403);
      expect(apiErrorSchema.parse(forbidden.body).code).toBe('FORBIDDEN');

      await authorAgent.delete(`/api/v1/posts/${postId}`).expect(204);
      await authorAgent.get(`/api/v1/posts/${postId}`).expect(404);
      await request(t.server).get(`/api/v1/uploads/${upload.key}`).expect(404);
      await authorAgent.delete(`/api/v1/posts/${postId}`).expect(404);
    });
  });

  it('counts comments', async () => {
    const author = await createUser(t.prisma);
    const authorAgent = await agentFor(t, author);
    const postId = await createPost(authorAgent, 'commented');
    await t.prisma.comment.createMany({
      data: [
        { postId, authorId: author.id, content: 'one' },
        { postId, authorId: author.id, content: 'two' },
      ],
    });

    expect(
      postSchema.parse((await authorAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
        .commentCount,
    ).toBe(2);
  });
});
