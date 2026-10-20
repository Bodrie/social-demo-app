import {
  apiErrorSchema,
  commentListSchema,
  commentSchema,
  notificationListSchema,
  postSchema,
  reactionSummarySchema,
  revisionListSchema,
} from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

async function createPost(agent: TestAgent, content: string): Promise<string> {
  return postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body)
    .id;
}

async function comment(agent: TestAgent, postId: string, content: string): Promise<string> {
  return commentSchema.parse(
    (await agent.post(`/api/v1/posts/${postId}/comments`).send({ content }).expect(201)).body,
  ).id;
}

const MISSING = '00000000-0000-7000-8000-000000000000';

describe('comments', () => {
  let t: TestApp;
  let poster: CreatedUser;
  let commenter: CreatedUser;
  let posterAgent: TestAgent;
  let commenterAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    poster = await createUser(t.prisma);
    commenter = await createUser(t.prisma);
    posterAgent = await agentFor(t, poster);
    commenterAgent = await agentFor(t, commenter);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('creates a comment and bumps the post comment count', async () => {
    const postId = await createPost(posterAgent, 'discuss');

    const response = await commenterAgent
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: '  Nice!  ' })
      .expect(201);
    const created = commentSchema.parse(response.body);

    expect(created).toMatchObject({
      postId,
      content: 'Nice!',
      author: { id: commenter.id, username: commenter.username },
    });
    expect(
      postSchema.parse((await posterAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
        .commentCount,
    ).toBe(1);
  });

  it('validates content and the post', async () => {
    const postId = await createPost(posterAgent, 'validate');

    const empty = await commenterAgent
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: '  ' })
      .expect(400);
    expect(apiErrorSchema.parse(empty.body).fields).toHaveProperty('content');
    await commenterAgent
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: 'x'.repeat(501) })
      .expect(400);
    await commenterAgent
      .post(`/api/v1/posts/${MISSING}/comments`)
      .send({ content: 'hi' })
      .expect(404);
    await request(t.server)
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: 'hi' })
      .expect(401);
  });

  it('lists comments newest first with cursor paging', async () => {
    const postId = await createPost(posterAgent, 'thread');
    const first = await comment(commenterAgent, postId, 'first');
    const second = await comment(posterAgent, postId, 'second');
    const third = await comment(commenterAgent, postId, 'third');

    const page1 = commentListSchema.parse(
      (await posterAgent.get(`/api/v1/posts/${postId}/comments?limit=2`).expect(200)).body,
    );
    expect(page1.items.map((c) => c.id)).toEqual([third, second]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = commentListSchema.parse(
      (
        await posterAgent
          .get(`/api/v1/posts/${postId}/comments?limit=2&cursor=${page1.nextCursor}`)
          .expect(200)
      ).body,
    );
    expect(page2.items.map((c) => c.id)).toEqual([first]);
    expect(page2.nextCursor).toBeNull();

    await posterAgent.get(`/api/v1/posts/${MISSING}/comments`).expect(404);
  });

  describe('DELETE /comments/:id', () => {
    it('is allowed for the comment author and for the post author, nobody else', async () => {
      const stranger = await createUser(t.prisma);
      const strangerAgent = await agentFor(t, stranger);
      const postId = await createPost(posterAgent, 'moderated');
      const byCommenter = await comment(commenterAgent, postId, 'mine');
      const byCommenterToo = await comment(commenterAgent, postId, 'also mine');

      const forbidden = await strangerAgent.delete(`/api/v1/comments/${byCommenter}`).expect(403);
      expect(apiErrorSchema.parse(forbidden.body).code).toBe('FORBIDDEN');

      await commenterAgent.delete(`/api/v1/comments/${byCommenter}`).expect(204);
      await posterAgent.delete(`/api/v1/comments/${byCommenterToo}`).expect(204);
      await commenterAgent.delete(`/api/v1/comments/${byCommenter}`).expect(404);

      const list = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/posts/${postId}/comments`).expect(200)).body,
      );
      expect(list.items).toHaveLength(0);
      expect(
        postSchema.parse((await posterAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
          .commentCount,
      ).toBe(0);
    });

    it('comments disappear with their post', async () => {
      const postId = await createPost(posterAgent, 'temporary');
      const id = await comment(commenterAgent, postId, 'gone soon');

      await posterAgent.delete(`/api/v1/posts/${postId}`).expect(204);

      expect(await t.prisma.comment.count({ where: { id } })).toBe(0);
    });
  });

  describe('editing', () => {
    it('lets the author edit and keeps the previous text as a revision; unchanged text is a no-op', async () => {
      const postId = await createPost(posterAgent, 'Edit me');
      const id = await comment(commenterAgent, postId, 'first');

      const updated = commentSchema.parse(
        (
          await commenterAgent
            .patch(`/api/v1/comments/${id}`)
            .send({ content: 'second' })
            .expect(200)
        ).body,
      );
      expect(updated.content).toBe('second');
      expect(updated.editedAt).not.toBeNull();

      await commenterAgent.patch(`/api/v1/comments/${id}`).send({ content: 'second' }).expect(200);
      const revisions = revisionListSchema.parse(
        (await posterAgent.get(`/api/v1/comments/${id}/revisions`).expect(200)).body,
      );
      expect(revisions.items.map((revision) => revision.content)).toEqual(['first']);

      const listed = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/posts/${postId}/comments`).expect(200)).body,
      );
      expect(listed.items[0]).toMatchObject({ content: 'second', editedAt: updated.editedAt });
    });

    it('refuses edits by anyone but the author, the post author included', async () => {
      const postId = await createPost(posterAgent, 'Not yours');
      const id = await comment(commenterAgent, postId, 'mine');
      const body = apiErrorSchema.parse(
        (await posterAgent.patch(`/api/v1/comments/${id}`).send({ content: 'hijack' }).expect(403))
          .body,
      );
      expect(body.code).toBe('FORBIDDEN');
      await posterAgent.patch(`/api/v1/comments/${MISSING}`).send({ content: 'x' }).expect(404);
      await posterAgent.get(`/api/v1/comments/${MISSING}/revisions`).expect(404);
    });
  });

  describe('reactions', () => {
    const counts = (over: Partial<Record<string, number>>) => ({
      LIKE: 0,
      LOVE: 0,
      LAUGH: 0,
      WOW: 0,
      SAD: 0,
      ...over,
    });

    it('sets, switches and removes a reaction, keeping counts, total and "mine" in step', async () => {
      const postId = await createPost(posterAgent, 'React to this');
      const id = await comment(commenterAgent, postId, 'hello');
      const react = async (agent: TestAgent, type: string) =>
        reactionSummarySchema.parse(
          (await agent.put(`/api/v1/comments/${id}/reaction`).send({ type }).expect(200)).body,
        );

      expect(await react(posterAgent, 'LOVE')).toEqual({
        counts: counts({ LOVE: 1 }),
        total: 1,
        mine: 'LOVE',
      });
      expect(await react(posterAgent, 'LIKE')).toEqual({
        counts: counts({ LIKE: 1 }),
        total: 1,
        mine: 'LIKE',
      });
      expect(await react(commenterAgent, 'LIKE')).toEqual({
        counts: counts({ LIKE: 2 }),
        total: 2,
        mine: 'LIKE',
      });

      const listed = commentListSchema.parse(
        (await commenterAgent.get(`/api/v1/posts/${postId}/comments`).expect(200)).body,
      );
      expect(listed.items[0]?.reactions).toEqual({
        counts: counts({ LIKE: 2 }),
        total: 2,
        mine: 'LIKE',
      });

      const removed = reactionSummarySchema.parse(
        (await posterAgent.delete(`/api/v1/comments/${id}/reaction`).expect(200)).body,
      );
      expect(removed).toEqual({ counts: counts({ LIKE: 1 }), total: 1, mine: null });
      const again = reactionSummarySchema.parse(
        (await posterAgent.delete(`/api/v1/comments/${id}/reaction`).expect(200)).body,
      );
      expect(again.total).toBe(1);
    });

    it('validates the reaction type and the comment', async () => {
      const postId = await createPost(posterAgent, 'Validate');
      const id = await comment(commenterAgent, postId, 'hi');
      const body = apiErrorSchema.parse(
        (
          await posterAgent
            .put(`/api/v1/comments/${id}/reaction`)
            .send({ type: 'FIRE' })
            .expect(400)
        ).body,
      );
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.fields).toHaveProperty('type');
      await posterAgent
        .put(`/api/v1/comments/${MISSING}/reaction`)
        .send({ type: 'LIKE' })
        .expect(404);
    });

    it('sorts by most reactions on request and paginates that order with a ranked cursor', async () => {
      const postId = await createPost(posterAgent, 'Sort me');
      const a = await comment(commenterAgent, postId, 'a');
      const b = await comment(commenterAgent, postId, 'b');
      const c = await comment(commenterAgent, postId, 'c');
      await posterAgent.put(`/api/v1/comments/${b}/reaction`).send({ type: 'LIKE' }).expect(200);
      await commenterAgent.put(`/api/v1/comments/${b}/reaction`).send({ type: 'WOW' }).expect(200);
      await posterAgent.put(`/api/v1/comments/${c}/reaction`).send({ type: 'LAUGH' }).expect(200);

      const newest = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/posts/${postId}/comments`).expect(200)).body,
      );
      expect(newest.items.map((item) => item.id)).toEqual([c, b, a]);

      const top = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/posts/${postId}/comments?sort=top`).expect(200)).body,
      );
      expect(top.items.map((item) => item.id)).toEqual([b, c, a]);

      const page1 = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/posts/${postId}/comments?sort=top&limit=1`).expect(200))
          .body,
      );
      expect(page1.items.map((item) => item.id)).toEqual([b]);
      expect(page1.nextCursor).not.toBeNull();
      const page2 = commentListSchema.parse(
        (
          await posterAgent
            .get(`/api/v1/posts/${postId}/comments?sort=top&limit=1&cursor=${page1.nextCursor}`)
            .expect(200)
        ).body,
      );
      expect(page2.items.map((item) => item.id)).toEqual([c]);
      const page3 = commentListSchema.parse(
        (
          await posterAgent
            .get(`/api/v1/posts/${postId}/comments?sort=top&limit=1&cursor=${page2.nextCursor}`)
            .expect(200)
        ).body,
      );
      expect(page3.items.map((item) => item.id)).toEqual([a]);
      expect(page3.nextCursor).toBeNull();

      await posterAgent.get(`/api/v1/posts/${postId}/comments?sort=top&cursor=garbage`).expect(400);
      await posterAgent.get(`/api/v1/posts/${postId}/comments?sort=sideways`).expect(400);
    });
  });
  describe('replies (C2)', () => {
    it('sit one level under a comment, oldest first, counted on the parent and the post', async () => {
      const postId = await createPost(posterAgent, 'threaded');
      const parentId = await comment(commenterAgent, postId, 'top level');
      const reply = async (agent: TestAgent, content: string, target = parentId) =>
        commentSchema.parse(
          (
            await agent
              .post(`/api/v1/posts/${postId}/comments`)
              .send({ content, parentId: target })
              .expect(201)
          ).body,
        );
      const first = await reply(posterAgent, `@${commenter.username} first reply`);
      expect(first).toMatchObject({ parentId, replyCount: 0 });
      // A reply to a reply lands under the same parent: one level only.
      const second = await reply(commenterAgent, 'second reply', first.id);
      expect(second.parentId).toBe(parentId);

      const top = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/posts/${postId}/comments`).expect(200)).body,
      );
      expect(top.items.map((c) => [c.id, c.replyCount])).toEqual([[parentId, 2]]);
      expect(
        postSchema.parse((await posterAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
          .commentCount,
      ).toBe(3);

      const page1 = commentListSchema.parse(
        (await posterAgent.get(`/api/v1/comments/${parentId}/replies?limit=1`).expect(200)).body,
      );
      expect(page1.items.map((c) => c.id)).toEqual([first.id]);
      const page2 = commentListSchema.parse(
        (
          await posterAgent
            .get(`/api/v1/comments/${parentId}/replies?limit=1&cursor=${page1.nextCursor}`)
            .expect(200)
        ).body,
      );
      expect(page2.items.map((c) => c.id)).toEqual([second.id]);
      expect(page2.nextCursor).toBeNull();
      await posterAgent.get(`/api/v1/comments/${MISSING}/replies`).expect(404);

      // Only a comment of the same post can be answered.
      const elsewhere = await createPost(posterAgent, 'elsewhere');
      const wrongPost = await posterAgent
        .post(`/api/v1/posts/${elsewhere}/comments`)
        .send({ content: 'x', parentId })
        .expect(400);
      expect(apiErrorSchema.parse(wrongPost.body).fields).toHaveProperty('parentId');
      const noParent = await posterAgent
        .post(`/api/v1/posts/${postId}/comments`)
        .send({ content: 'x', parentId: MISSING })
        .expect(400);
      expect(apiErrorSchema.parse(noParent.body).fields).toHaveProperty('parentId');

      // The parent's author hears of a reply once, even when it names them; the post's author
      // hears of every comment on the post, unless the reply was to their own comment.
      const own = await comment(posterAgent, postId, 'my own comment');
      const toOwn = await reply(commenterAgent, 'to the author', own);
      const notesOn = async (agent: TestAgent) =>
        notificationListSchema
          .parse((await agent.get('/api/v1/notifications').expect(200)).body)
          .items.filter((n) => n.post?.id === postId)
          .map((n) => [n.type, n.comment?.id]);
      expect(await notesOn(commenterAgent)).toEqual([['COMMENT_REPLIED', first.id]]);
      expect(await notesOn(posterAgent)).toEqual([
        ['COMMENT_REPLIED', toOwn.id],
        ['POST_COMMENTED', second.id],
        ['POST_COMMENTED', parentId],
      ]);

      // Deleting the parent takes its replies with it; the post count follows.
      await commenterAgent.delete(`/api/v1/comments/${parentId}`).expect(204);
      expect(await t.prisma.comment.count({ where: { parentId } })).toBe(0);
      expect(
        postSchema.parse((await posterAgent.get(`/api/v1/posts/${postId}`).expect(200)).body)
          .commentCount,
      ).toBe(2);
    });
  });
});
