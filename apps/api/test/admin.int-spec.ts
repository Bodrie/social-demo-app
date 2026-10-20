import { randomUUID } from 'node:crypto';
import {
  type Post,
  adminReportListSchema,
  adminReportSchema,
  apiErrorSchema,
  commentSchema,
  meResponseSchema,
  postListSchema,
  postSchema,
  reportSchema,
} from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import {
  TEST_PASSWORD,
  type CreatedUser,
  type TestAgent,
  createUser,
  login,
} from './setup/factories.js';

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

const createPost = async (agent: TestAgent, content: string): Promise<Post> =>
  postSchema.parse((await agent.post('/api/v1/posts').send({ content }).expect(201)).body);
const report = async (
  agent: TestAgent,
  body: { targetType: 'post' | 'comment' | 'user'; targetId: string; reason: string },
): Promise<string> =>
  reportSchema.parse((await agent.post('/api/v1/reports').send(body).expect(201)).body).id;
const queue = async (agent: TestAgent, query = '') =>
  adminReportListSchema.parse((await agent.get(`/api/v1/admin/reports${query}`).expect(200)).body);
const codeOf = (body: unknown): string => apiErrorSchema.parse(body).code;

describe('admin: the role, the queue, and what an admin may do (ADR 0016)', () => {
  let t: TestApp;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let carol: CreatedUser;
  let aliceAgent: TestAgent;
  let bobAgent: TestAgent;
  let carolAgent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    alice = await createUser(t.prisma, { username: 'alice' });
    bob = await createUser(t.prisma, { username: 'bob' });
    carol = await createUser(t.prisma, { username: 'carol' });
    // The role travels in the token: it must be set before the session is opened.
    await t.prisma.user.update({ where: { id: alice.id }, data: { role: 'admin' } });
    aliceAgent = await agentFor(t, alice);
    bobAgent = await agentFor(t, bob);
    carolAgent = await agentFor(t, carol);
    await carolAgent.put(`/api/v1/users/${bob.id}/follow`).expect(204);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('exposes the role and keeps members out of every admin route', async () => {
    expect(meResponseSchema.parse((await aliceAgent.get('/api/v1/auth/me')).body).user.role).toBe(
      'admin',
    );
    expect(meResponseSchema.parse((await bobAgent.get('/api/v1/auth/me')).body).user.role).toBe(
      'member',
    );
    expect(codeOf((await bobAgent.get('/api/v1/admin/reports').expect(403)).body)).toBe(
      'FORBIDDEN',
    );
    await bobAgent.post(`/api/v1/admin/reports/${randomUUID()}/resolve`).expect(403);
    await bobAgent.delete(`/api/v1/admin/posts/${randomUUID()}`).expect(403);
    await bobAgent.post(`/api/v1/admin/users/${alice.id}/suspend`).expect(403);
    await request(t.server).get('/api/v1/admin/reports').expect(401);
  });

  it('lists the queue with what each report points at, and settles reports with an audit row', async () => {
    const post = await createPost(bobAgent, 'Reported post');
    const comment = commentSchema.parse(
      (
        await bobAgent
          .post(`/api/v1/posts/${post.id}/comments`)
          .send({ content: 'Reported comment' })
          .expect(201)
      ).body,
    );
    const doomed = await createPost(bobAgent, 'Soon gone');
    const onPost = await report(carolAgent, {
      targetType: 'post',
      targetId: post.id,
      reason: 'spam',
    });
    const onComment = await report(carolAgent, {
      targetType: 'comment',
      targetId: comment.id,
      reason: 'harassment',
    });
    const onUser = await report(carolAgent, {
      targetType: 'user',
      targetId: bob.id,
      reason: 'other',
    });
    const onDoomed = await report(carolAgent, {
      targetType: 'post',
      targetId: doomed.id,
      reason: 'hate',
    });
    await bobAgent.delete(`/api/v1/posts/${doomed.id}`).expect(204);

    const open = await queue(aliceAgent);
    expect(open.items.map((item) => item.id)).toEqual([onDoomed, onUser, onComment, onPost]);
    expect(open.items[0]?.target).toEqual({
      type: 'post',
      id: doomed.id,
      gone: true,
      excerpt: null,
      postId: null,
      member: null,
    });
    expect(open.items[1]?.target).toMatchObject({
      type: 'user',
      gone: false,
      excerpt: null,
      member: { username: 'bob', suspended: false },
    });
    expect(open.items[2]?.target).toMatchObject({
      type: 'comment',
      gone: false,
      excerpt: 'Reported comment',
      postId: post.id,
      member: { username: 'bob' },
    });
    expect(open.items[3]).toMatchObject({
      reason: 'spam',
      reporter: { username: 'carol' },
      target: { type: 'post', excerpt: 'Reported post', postId: post.id },
    });

    const resolved = adminReportSchema.parse(
      (await aliceAgent.post(`/api/v1/admin/reports/${onPost}/resolve`).expect(200)).body,
    );
    expect(resolved).toMatchObject({ id: onPost, status: 'resolved' });
    expect(resolved.resolvedAt).toEqual(expect.any(String));
    await aliceAgent.post(`/api/v1/admin/reports/${onDoomed}/dismiss`).expect(200);
    await aliceAgent.post(`/api/v1/admin/reports/${randomUUID()}/resolve`).expect(404);
    expect((await queue(aliceAgent)).items.map((item) => item.id)).toEqual([onUser, onComment]);
    expect((await queue(aliceAgent, '?status=resolved')).items.map((item) => item.id)).toEqual([
      onPost,
    ]);
    expect((await queue(aliceAgent, '?status=dismissed')).items.map((item) => item.id)).toEqual([
      onDoomed,
    ]);
    const actions = await t.prisma.adminAction.findMany({
      where: { adminId: alice.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.map((action) => [action.action, action.targetId])).toEqual([
      ['report_resolved', onPost],
      ['report_dismissed', onDoomed],
    ]);
  });

  it('lets an admin remove content and suspend a member, who is then out and unseen', async () => {
    const post = await createPost(bobAgent, 'Remove me');
    const comment = commentSchema.parse(
      (
        await carolAgent
          .post(`/api/v1/posts/${post.id}/comments`)
          .send({ content: 'remove me too' })
          .expect(201)
      ).body,
    );
    const kept = await createPost(bobAgent, 'Still here');
    await aliceAgent.delete(`/api/v1/admin/comments/${comment.id}`).expect(204);
    await aliceAgent.delete(`/api/v1/admin/posts/${post.id}`).expect(204);
    await carolAgent.get(`/api/v1/posts/${post.id}`).expect(404);
    await aliceAgent.delete(`/api/v1/admin/posts/${post.id}`).expect(404);

    await aliceAgent.post(`/api/v1/admin/users/${alice.id}/suspend`).expect(400);
    await aliceAgent.post(`/api/v1/admin/users/${randomUUID()}/suspend`).expect(404);
    await aliceAgent.post(`/api/v1/admin/users/${bob.id}/suspend`).expect(204);
    await aliceAgent.post(`/api/v1/admin/users/${bob.id}/suspend`).expect(204);

    // Out: the sessions are gone, no new one opens, the one still holding a token is refused.
    expect(await t.prisma.refreshToken.count({ where: { userId: bob.id } })).toBe(0);
    expect(
      codeOf(
        (
          await request(t.server)
            .post('/api/v1/auth/login')
            .send({ email: bob.email, password: TEST_PASSWORD })
            .expect(403)
        ).body,
      ),
    ).toBe('SUSPENDED');
    expect(codeOf((await bobAgent.get('/api/v1/auth/me').expect(403)).body)).toBe('SUSPENDED');
    // Unseen: the profile and the posts are gone for everyone else; the rows stay.
    await carolAgent.get('/api/v1/users/by-username/bob').expect(404);
    await carolAgent.get(`/api/v1/posts/${kept.id}`).expect(404);
    expect(
      postListSchema
        .parse((await carolAgent.get('/api/v1/posts').expect(200)).body)
        .items.map((item) => item.id),
    ).not.toContain(kept.id);
    expect((await queue(aliceAgent)).items[0]?.target.member?.suspended).toBe(true);
    expect(await t.prisma.post.count({ where: { authorId: bob.id } })).toBeGreaterThan(0);

    // An admin cannot be suspended: demote first.
    await t.prisma.user.update({ where: { id: carol.id }, data: { role: 'admin' } });
    await aliceAgent.post(`/api/v1/admin/users/${carol.id}/suspend`).expect(400);
    await t.prisma.user.update({ where: { id: carol.id }, data: { role: 'member' } });

    // The way back.
    await aliceAgent.post(`/api/v1/admin/users/${bob.id}/unsuspend`).expect(204);
    await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email: bob.email, password: TEST_PASSWORD })
      .expect(200);
    await carolAgent.get('/api/v1/users/by-username/bob').expect(200);
    await carolAgent.get(`/api/v1/posts/${kept.id}`).expect(200);
    const actions = await t.prisma.adminAction.findMany({
      where: { adminId: alice.id, action: { in: ['user_suspended', 'user_unsuspended'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.map((action) => action.action)).toEqual([
      'user_suspended',
      'user_suspended',
      'user_unsuspended',
    ]);
  });
});
