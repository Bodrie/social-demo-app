import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  apiErrorSchema,
  commentSchema,
  postListSchema,
  postSchema,
  trendingTagListSchema,
} from '@beso/shared';
import request from 'supertest';
import { UserMentionedEvent } from '../src/events/user.events.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

async function createPost(agent: TestAgent, content: string) {
  const response = await agent.post('/api/v1/posts').send({ content }).expect(201);
  return postSchema.parse(response.body);
}

describe('text entities (mentions, hashtags)', () => {
  let t: TestApp;
  let mentioned: UserMentionedEvent[];

  beforeAll(async () => {
    t = await createTestApp();
    mentioned = [];
    t.app.get(EventEmitter2).on(UserMentionedEvent.EVENT, (event: UserMentionedEvent) => {
      mentioned.push(event);
    });
  });

  beforeEach(() => {
    mentioned.length = 0;
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('posts', () => {
    it('resolves mentioned members, drops unknown names and folds tags', async () => {
      const me = await createUser(t.prisma);
      const friend = await createUser(t.prisma, { username: 'friend_one', name: 'Friend One' });
      const agent = await agentFor(t, me);

      const post = await createPost(
        agent,
        `Hey @Friend_One and @nobody_here, #Weekend plans? #weekend #2026 mail@example.com https://x.y/#tag`,
      );

      expect(post.mentions).toEqual([
        { id: friend.id, username: 'friend_one', name: 'Friend One', avatarUrl: null },
      ]);
      expect(post.hashtags).toEqual(['weekend']);
      expect(mentioned).toEqual([new UserMentionedEvent(me.id, friend.id, post.id, null)]);
    });

    it('does not tell the author about mentioning themselves', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);

      const post = await createPost(agent, `Note to self: @${me.username}`);

      expect(post.mentions.map((user) => user.id)).toEqual([me.id]);
      expect(mentioned).toEqual([]);
    });

    it('re-parses on edit and only announces new mentions', async () => {
      const me = await createUser(t.prisma);
      const first = await createUser(t.prisma);
      const second = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const post = await createPost(agent, `@${first.username} #before`);
      mentioned.length = 0;

      const edited = postSchema.parse(
        (
          await agent
            .patch(`/api/v1/posts/${post.id}`)
            .send({ content: `@${first.username} @${second.username} #after` })
            .expect(200)
        ).body,
      );

      expect(edited.mentions.map((user) => user.id).toSorted()).toEqual(
        [first.id, second.id].toSorted(),
      );
      expect(edited.hashtags).toEqual(['after']);
      expect(mentioned).toEqual([new UserMentionedEvent(me.id, second.id, post.id, null)]);
      const rows = await t.prisma.postHashtag.findMany({ where: { postId: post.id } });
      expect(rows.map((row) => row.tag)).toEqual(['after']);
    });
  });

  describe('comments', () => {
    it('resolves mentions and announces them with the comment id', async () => {
      const me = await createUser(t.prisma);
      const friend = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const post = await createPost(agent, 'A post');
      mentioned.length = 0;

      const comment = commentSchema.parse(
        (
          await agent
            .post(`/api/v1/posts/${post.id}/comments`)
            .send({ content: `cc @${friend.username.toUpperCase()}` })
            .expect(201)
        ).body,
      );

      expect(comment.mentions.map((user) => user.id)).toEqual([friend.id]);
      expect(mentioned).toEqual([new UserMentionedEvent(me.id, friend.id, post.id, comment.id)]);

      mentioned.length = 0;
      const edited = commentSchema.parse(
        (
          await agent
            .patch(`/api/v1/comments/${comment.id}`)
            .send({ content: 'nobody now' })
            .expect(200)
        ).body,
      );
      expect(edited.mentions).toEqual([]);
      expect(mentioned).toEqual([]);
    });
  });

  describe('GET /tags/:tag/posts', () => {
    it('lists the posts of a tag newest first, folding the case and a leading #', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const older = await createPost(agent, 'old #Trip');
      const newer = await createPost(agent, 'new #trip and #other');
      await createPost(agent, 'unrelated');

      const page = postListSchema.parse(
        (await agent.get('/api/v1/tags/TRIP/posts').expect(200)).body,
      );
      expect(page.items.map((post) => post.id)).toEqual([newer.id, older.id]);

      const encoded = postListSchema.parse(
        (await agent.get('/api/v1/tags/%23trip/posts').expect(200)).body,
      );
      expect(encoded.items).toHaveLength(2);
    });

    it('paginates with a cursor and answers an empty list for an unused tag', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const first = await createPost(agent, '#pages 1');
      const second = await createPost(agent, '#pages 2');
      const third = await createPost(agent, '#pages 3');

      const page1 = postListSchema.parse(
        (await agent.get('/api/v1/tags/pages/posts?limit=2').expect(200)).body,
      );
      expect(page1.items.map((post) => post.id)).toEqual([third.id, second.id]);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = postListSchema.parse(
        (await agent.get(`/api/v1/tags/pages/posts?limit=2&cursor=${page1.nextCursor}`).expect(200))
          .body,
      );
      expect(page2.items.map((post) => post.id)).toEqual([first.id]);
      expect(page2.nextCursor).toBeNull();

      const none = postListSchema.parse(
        (await agent.get('/api/v1/tags/never_used_tag/posts').expect(200)).body,
      );
      expect(none).toEqual({ items: [], nextCursor: null });
    });

    it('refuses a tag the parser would never produce', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);

      const response = await agent.get('/api/v1/tags/2026/posts').expect(400);
      const error = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fields).toHaveProperty('tag');
    });

    it('stops listing a post once it is deleted', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      const post = await createPost(agent, '#gone soon');

      await agent.delete(`/api/v1/posts/${post.id}`).expect(204);

      const page = postListSchema.parse(
        (await agent.get('/api/v1/tags/gone/posts').expect(200)).body,
      );
      expect(page.items).toEqual([]);
    });
  });

  describe('GET /tags/trending', () => {
    it('counts posts per tag over the last week, most used first', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      // Tag rows from the other tests of this file would otherwise rank too.
      await t.prisma.postHashtag.deleteMany({});
      await createPost(agent, '#alpha #beta');
      await createPost(agent, '#alpha');
      const stale = await createPost(agent, '#alpha #gamma');
      // Older than the window: the tag rows carry the post's timestamp.
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await t.prisma.postHashtag.updateMany({
        where: { postId: stale.id },
        data: { createdAt: eightDaysAgo },
      });

      const trending = trendingTagListSchema.parse(
        (await agent.get('/api/v1/tags/trending?limit=2').expect(200)).body,
      );
      expect(trending).toEqual({
        items: [
          { tag: 'alpha', count: 2 },
          { tag: 'beta', count: 1 },
        ],
        nextCursor: null,
      });
    });

    it('needs a session', async () => {
      await request(t.server).get('/api/v1/tags/trending').expect(401);
    });
  });
  describe('GET /tags/suggest', () => {
    it('offers tags starting with the prefix, folded, from the last 90 days, most used first', async () => {
      const me = await createUser(t.prisma);
      const agent = await agentFor(t, me);
      await t.prisma.postHashtag.deleteMany({});
      await createPost(agent, '#summer #sunday');
      await createPost(agent, '#Summer #spring');
      const old = await createPost(agent, '#sunset');
      await t.prisma.postHashtag.updateMany({
        where: { postId: old.id },
        data: { createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) },
      });
      const suggest = async (q: string) =>
        trendingTagListSchema.parse(
          (await agent.get(`/api/v1/tags/suggest?q=${encodeURIComponent(q)}`).expect(200)).body,
        ).items;

      const summer = [
        { tag: 'summer', count: 2 },
        { tag: 'sunday', count: 1 },
      ];
      expect(await suggest('su')).toEqual(summer);
      expect(await suggest('#SU')).toEqual(summer);
      expect(await suggest('sp')).toEqual([{ tag: 'spring', count: 1 }]);
      expect(await suggest('zz')).toEqual([]);
      await agent.get('/api/v1/tags/suggest').expect(400);
      await agent.get('/api/v1/tags/suggest?q=a%20b').expect(400);

      // At most eight, by use then name.
      await createPost(agent, '#t1 #t2 #t3 #t4 #t5 #t6 #t7 #t8 #t9');
      expect((await suggest('t')).map((item) => item.tag)).toEqual([
        't1',
        't2',
        't3',
        't4',
        't5',
        't6',
        't7',
        't8',
      ]);
    });
  });
});
