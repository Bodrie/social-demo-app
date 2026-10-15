import { apiErrorSchema, meResponseSchema, userListSchema, userPublicSchema } from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { resetDatabase } from './setup/database.js';
import { createUser, login } from './setup/factories.js';

describe('users', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('public profiles', () => {
    it('returns the public shape by id, without private fields', async () => {
      const viewer = await createUser(t.prisma);
      const target = await createUser(t.prisma, { bio: 'Hello', city: 'Sofia' });
      const agent = request.agent(t.server);
      await login(agent, viewer.email);

      const response = await agent.get(`/api/v1/users/${target.id}`).expect(200);
      const user = userPublicSchema.parse(response.body);

      expect(user).toMatchObject({ id: target.id, username: target.username, bio: 'Hello', city: 'Sofia', avatarUrl: null });
      expect(response.body).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('looks up by username case-insensitively', async () => {
      const viewer = await createUser(t.prisma);
      const target = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, viewer.email);

      const response = await agent.get(`/api/v1/users/by-username/${target.username.toUpperCase()}`).expect(200);
      expect(response.body.id).toBe(target.id);
    });

    it('404s on unknown users and 400s on malformed ids', async () => {
      const viewer = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, viewer.email);

      const missing = await agent.get('/api/v1/users/00000000-0000-7000-8000-000000000000').expect(404);
      expect(apiErrorSchema.parse(missing.body).code).toBe('NOT_FOUND');
      const malformed = await agent.get('/api/v1/users/not-a-uuid').expect(400);
      expect(apiErrorSchema.parse(malformed.body)).toMatchObject({ code: 'VALIDATION_ERROR', fields: { id: expect.any(String) } });
    });

    it('requires a session', async () => {
      const target = await createUser(t.prisma);
      await request(t.server).get(`/api/v1/users/${target.id}`).expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('updates the own profile and normalises the username', async () => {
      const user = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, user.email);

      const response = await agent
        .patch('/api/v1/users/me')
        .send({ username: ' Renamed_1 ', bio: 'New bio', website: 'https://example.com', city: null })
        .expect(200);

      const { user: me } = meResponseSchema.parse(response.body);
      expect(me).toMatchObject({ username: 'renamed_1', bio: 'New bio', website: 'https://example.com', city: null, email: user.email });
      expect((await agent.get('/api/v1/auth/me').expect(200)).body.user.username).toBe('renamed_1');
    });

    it('lets a user change their email and log in with it, and keep their own username', async () => {
      const user = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, user.email);

      await agent.patch('/api/v1/users/me').send({ username: user.username }).expect(200);
      const changed = meResponseSchema.parse((await agent.patch('/api/v1/users/me').send({ email: 'Fresh@Example.com' }).expect(200)).body);
      expect(changed.user.email).toBe('fresh@example.com');
      await login(request.agent(t.server), 'fresh@example.com');
    });

    it('stores blank optional text as null and ignores no-op patches', async () => {
      const user = await createUser(t.prisma, { bio: 'old' });
      const agent = request.agent(t.server);
      await login(agent, user.email);

      const cleared = meResponseSchema.parse((await agent.patch('/api/v1/users/me').send({ bio: '', city: '  ' }).expect(200)).body);
      expect(cleared.user).toMatchObject({ bio: null, city: null });
      const unchanged = meResponseSchema.parse((await agent.patch('/api/v1/users/me').send({}).expect(200)).body);
      expect(unchanged.user.updatedAt).toBe(cleared.user.updatedAt);
    });

    it('refuses a username that another user holds', async () => {
      const user = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, user.email);

      const response = await agent.patch('/api/v1/users/me').send({ username: other.username }).expect(409);
      expect(apiErrorSchema.parse(response.body).fields).toEqual({ username: 'This username is taken' });
    });

    it('validates fields', async () => {
      const user = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, user.email);

      const response = await agent.patch('/api/v1/users/me').send({ website: 'nope', bio: 'x'.repeat(301) }).expect(400);
      expect(Object.keys(apiErrorSchema.parse(response.body).fields ?? {}).toSorted()).toEqual(['bio', 'website']);
    });
  });

  describe('GET /users (search + pagination)', () => {
    beforeAll(async () => {
      await resetDatabase(t.prisma);
    });

    it('searches by name or username and pages with an opaque cursor', async () => {
      const viewer = await createUser(t.prisma, { username: 'viewer', name: 'Viewer' });
      await createUser(t.prisma, { username: 'alice_a', name: 'Alice Anderson' });
      await createUser(t.prisma, { username: 'bobby', name: 'Bob Alicante' });
      await createUser(t.prisma, { username: 'carol', name: 'Carol Clark' });
      const agent = request.agent(t.server);
      await login(agent, viewer.email);

      const search = userListSchema.parse((await agent.get('/api/v1/users?q=ALIC').expect(200)).body);
      expect(search.items.map((u) => u.username).toSorted()).toEqual(['alice_a', 'bobby']);
      expect(search.nextCursor).toBeNull();

      const firstPage = userListSchema.parse((await agent.get('/api/v1/users?limit=2').expect(200)).body);
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = userListSchema.parse(
        (await agent.get(`/api/v1/users?limit=2&cursor=${firstPage.nextCursor}`).expect(200)).body,
      );
      expect(secondPage.items).toHaveLength(2);
      expect(secondPage.nextCursor).toBeNull();
      const ids = [...firstPage.items, ...secondPage.items].map((u) => u.id);
      expect(new Set(ids).size).toBe(4);
    });

    it('rejects malformed cursors', async () => {
      const viewer = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, viewer.email);

      const response = await agent.get('/api/v1/users?cursor=zzz').expect(400);
      expect(apiErrorSchema.parse(response.body)).toMatchObject({ code: 'VALIDATION_ERROR', fields: { cursor: 'Invalid cursor' } });
    });
  });

  describe('GET /users/suggestions', () => {
    it('excludes the viewer and anyone connected in either direction', async () => {
      await resetDatabase(t.prisma);
      const me = await createUser(t.prisma);
      const followed = await createUser(t.prisma);
      const follower = await createUser(t.prisma);
      const strangerA = await createUser(t.prisma);
      const strangerB = await createUser(t.prisma);
      await t.prisma.follow.createMany({
        data: [
          { followerId: me.id, followeeId: followed.id },
          { followerId: follower.id, followeeId: me.id },
        ],
      });
      const agent = request.agent(t.server);
      await login(agent, me.email);

      const response = await agent.get('/api/v1/users/suggestions?limit=10').expect(200);
      const ids = userListSchema
        .parse(response.body)
        .items.map((u) => u.id)
        .toSorted();

      expect(ids).toEqual([strangerA.id, strangerB.id].toSorted());
    });
  });
});
