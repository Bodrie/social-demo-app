import {
  type UploadResponse,
  apiErrorSchema,
  isAvailableEmbed,
  postListSchema,
  postSchema,
  revisionListSchema,
  uploadResponseSchema,
} from '@beso/shared';
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

async function uploadPicture(agent: TestAgent, width = 640, height = 480): Promise<UploadResponse> {
  const image = await sharp({ create: { width, height, channels: 3, background: '#224466' } })
    .png()
    .toBuffer();
  const response = await agent
    .post('/api/v1/uploads?kind=post')
    .attach('file', image, 'pic.png')
    .expect(201);
  return uploadResponseSchema.parse(response.body);
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
    it('creates a post with uploaded pictures in their order, each with its size', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const wide = await uploadPicture(agent, 640, 480);
      const tall = await uploadPicture(agent, 300, 600);
      const square = await uploadPicture(agent, 400, 400);

      const response = await agent
        .post('/api/v1/posts')
        .send({ content: '  First!  ', imageKeys: [tall.key, wide.key, square.key] })
        .expect(201);
      const post = postSchema.parse(response.body);

      expect(post).toMatchObject({
        content: 'First!',
        images: [
          { url: tall.url, width: 300, height: 600 },
          { url: wide.url, width: 640, height: 480 },
          { url: square.url, width: 400, height: 400 },
        ],
        imageUrl: tall.url,
        likeCount: 0,
        commentCount: 0,
        likedByMe: false,
        author: { id: me.id, username: me.username },
      });
      const fetched = postSchema.parse(
        (await agent.get(`/api/v1/posts/${post.id}`).expect(200)).body,
      );
      expect(fetched.images).toEqual(post.images);

      // A quote shows the original's pictures in its embed.
      const quote = postSchema.parse(
        (
          await agent
            .post('/api/v1/posts')
            .send({ content: 'look', quotedPostId: post.id })
            .expect(201)
        ).body,
      );
      expect(quote.images).toEqual([]);
      expect(quote.imageUrl).toBeNull();
      expect(quote.quotedPost && isAvailableEmbed(quote.quotedPost)).toBe(true);
      expect(quote.quotedPost).toMatchObject({ images: post.images, imageUrl: tall.url });
    });

    it('still takes the single imageKey of tabs opened before D2', async () => {
      const agent = await agentFor(t, await createUser(t.prisma));
      const upload = await uploadPicture(agent);

      const response = await agent
        .post('/api/v1/posts')
        .send({ content: 'old tab', imageKey: upload.key })
        .expect(201);

      expect(postSchema.parse(response.body).images).toEqual([
        { url: upload.url, width: 640, height: 480 },
      ]);
    });

    it('refuses more than four pictures, the same one twice and uploads that are not mine', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const mine = await Promise.all([1, 2, 3, 4, 5].map(() => uploadPicture(agent, 64, 64)));
      const theirs = await uploadPicture(await agentFor(t, await createUser(t.prisma)), 64, 64);

      const five = await agent
        .post('/api/v1/posts')
        .send({ content: 'pics', imageKeys: mine.map((upload) => upload.key) })
        .expect(400);
      expect(apiErrorSchema.parse(five.body).fields).toHaveProperty('imageKeys');

      const twice = await agent
        .post('/api/v1/posts')
        .send({ content: 'pics', imageKeys: [mine[0]?.key, mine[0]?.key] })
        .expect(400);
      expect(apiErrorSchema.parse(twice.body).fields).toHaveProperty('imageKeys');

      const foreign = await agent
        .post('/api/v1/posts')
        .send({ content: 'pics', imageKeys: [mine[0]?.key, theirs.key] })
        .expect(400);
      expect(apiErrorSchema.parse(foreign.body).fields).toEqual({ imageKeys: 'Unknown upload' });
      // Nothing was attached on the way.
      expect(await t.prisma.postImage.count({ where: { key: mine[0]?.key } })).toBe(0);
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
        .send({ content: 'pic', imageKeys: ['avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp'] })
        .expect(400);
      expect(Object.keys(apiErrorSchema.parse(wrongKind.body).fields ?? {})).toEqual([
        expect.stringMatching(/^imageKeys/),
      ]);

      const unknown = await agent
        .post('/api/v1/posts')
        .send({ content: 'pic', imageKeys: ['post/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp'] })
        .expect(400);
      expect(apiErrorSchema.parse(unknown.body).fields).toEqual({ imageKeys: 'Unknown upload' });
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
      const second = await uploadPicture(authorAgent);
      const postId = postSchema.parse(
        (
          await authorAgent
            .post('/api/v1/posts')
            .send({ content: 'bye', imageKeys: [upload.key, second.key] })
            .expect(201)
        ).body,
      ).id;

      const forbidden = await otherAgent.delete(`/api/v1/posts/${postId}`).expect(403);
      expect(apiErrorSchema.parse(forbidden.body).code).toBe('FORBIDDEN');

      await authorAgent.delete(`/api/v1/posts/${postId}`).expect(204);
      await authorAgent.get(`/api/v1/posts/${postId}`).expect(404);
      // Every picture goes with the post.
      await request(t.server).get(`/api/v1/uploads/${upload.key}`).expect(404);
      await request(t.server).get(`/api/v1/uploads/${second.key}`).expect(404);
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

  describe('PATCH /posts/:id and GET /posts/:id/revisions', () => {
    it('lets the author edit the text and keeps every previous version, newest first', async () => {
      const author = await createUser(t.prisma);
      const agent = await agentFor(t, author);
      const id = await createPost(agent, 'v1');

      const v2 = postSchema.parse(
        (await agent.patch(`/api/v1/posts/${id}`).send({ content: 'v2' }).expect(200)).body,
      );
      expect(v2).toMatchObject({ content: 'v2' });
      expect(v2.editedAt).not.toBeNull();
      await agent.patch(`/api/v1/posts/${id}`).send({ content: 'v2' }).expect(200);
      await agent.patch(`/api/v1/posts/${id}`).send({ content: 'v3' }).expect(200);

      const revisions = revisionListSchema.parse(
        (await agent.get(`/api/v1/posts/${id}/revisions`).expect(200)).body,
      );
      expect(revisions.items.map((revision) => revision.content)).toEqual(['v2', 'v1']);

      const fetched = postSchema.parse((await agent.get(`/api/v1/posts/${id}`).expect(200)).body);
      expect(fetched.content).toBe('v3');
      expect(fetched.editedAt).not.toBeNull();
    });

    it('refuses edits by other members and validates the text', async () => {
      const author = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const authorAgent = await agentFor(t, author);
      const otherAgent = await agentFor(t, other);
      const id = await createPost(authorAgent, 'keep');

      const body = apiErrorSchema.parse(
        (await otherAgent.patch(`/api/v1/posts/${id}`).send({ content: 'nope' }).expect(403)).body,
      );
      expect(body.code).toBe('FORBIDDEN');
      await authorAgent.patch(`/api/v1/posts/${id}`).send({ content: '   ' }).expect(400);
      await authorAgent
        .patch('/api/v1/posts/00000000-0000-7000-8000-000000000000')
        .send({ content: 'x' })
        .expect(404);
      // Anyone signed in may read the history of a post they can see.
      const revisions = revisionListSchema.parse(
        (await otherAgent.get(`/api/v1/posts/${id}/revisions`).expect(200)).body,
      );
      expect(revisions.items).toEqual([]);
    });
  });
});
