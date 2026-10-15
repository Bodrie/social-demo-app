import { apiErrorSchema, authResponseSchema } from '@the-mesh/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { TEST_PASSWORD, cookiesFrom, createUser, login, setCookieHeader } from './setup/factories.js';

describe('auth', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('POST /auth/register', () => {
    it('creates the account, normalises identifiers and starts a session', async () => {
      const agent = request.agent(t.server);
      const response = await agent
        .post('/api/v1/auth/register')
        .send({ email: ' New@Example.com ', username: 'NewUser', name: ' New User ', password: TEST_PASSWORD })
        .expect(201);

      const { user } = authResponseSchema.parse(response.body);
      expect(user).toMatchObject({ email: 'new@example.com', username: 'newuser', name: 'New User' });
      expect(user.counts).toEqual({ posts: 0, followers: 0, following: 0 });

      const access = setCookieHeader(response.headers['set-cookie'], 'access_token');
      const refresh = setCookieHeader(response.headers['set-cookie'], 'refresh_token');
      expect(access).toMatch(/HttpOnly/);
      expect(access).toMatch(/Path=\//);
      expect(access).toMatch(/SameSite=Lax/);
      expect(refresh).toMatch(/Path=\/api\/v1\/auth/);

      const me = await agent.get('/api/v1/auth/me').expect(200);
      expect(me.body.user.id).toBe(user.id);
    });

    it('rejects a taken email or username with field errors', async () => {
      const existing = await createUser(t.prisma);
      const response = await request(t.server)
        .post('/api/v1/auth/register')
        .send({ email: existing.email, username: existing.username, name: 'Dup', password: TEST_PASSWORD })
        .expect(409);

      const error = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('CONFLICT');
      expect(Object.keys(error.fields ?? {})).toEqual(['email', 'username']);
    });

    it('validates the payload', async () => {
      const response = await request(t.server)
        .post('/api/v1/auth/register')
        .send({ email: 'nope', username: 'a b', name: '', password: 'short' })
        .expect(400);

      const error = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(error.fields ?? {}).toSorted()).toEqual(['email', 'name', 'password', 'username']);
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with the right password', async () => {
      const user = await createUser(t.prisma);
      const agent = request.agent(t.server);
      const response = await agent.post('/api/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD }).expect(200);

      expect(authResponseSchema.parse(response.body).user.id).toBe(user.id);
      await agent.get('/api/v1/auth/me').expect(200);
    });

    it('answers wrong passwords and unknown emails identically', async () => {
      const user = await createUser(t.prisma);
      const wrong = await request(t.server).post('/api/v1/auth/login').send({ email: user.email, password: 'nope-nope' }).expect(401);
      const unknown = await request(t.server).post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope' }).expect(401);

      expect(apiErrorSchema.parse(wrong.body).message).toBe('Invalid email or password');
      expect(unknown.body.message).toBe(wrong.body.message);
      expect(wrong.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('session', () => {
    it('rejects requests without a session', async () => {
      const response = await request(t.server).get('/api/v1/auth/me').expect(401);
      expect(apiErrorSchema.parse(response.body).code).toBe('UNAUTHORIZED');
    });

    it('accepts the access token as a Bearer header too', async () => {
      const user = await createUser(t.prisma);
      const loginResponse = await request(t.server).post('/api/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD });
      const { access_token: accessToken } = cookiesFrom(loginResponse.headers['set-cookie']);

      await request(t.server).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      await request(t.server).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and detects reuse of the old one', async () => {
      const user = await createUser(t.prisma);
      const first = await request(t.server).post('/api/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD });
      const oldRefresh = cookiesFrom(first.headers['set-cookie']).refresh_token;

      const rotated = await request(t.server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${oldRefresh}`)
        .expect(200);
      const newRefresh = cookiesFrom(rotated.headers['set-cookie']).refresh_token;
      expect(newRefresh).toBeDefined();
      expect(newRefresh).not.toBe(oldRefresh);

      // Replaying the rotated token is treated as theft: every session is revoked.
      await request(t.server).post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${oldRefresh}`).expect(401);
      await request(t.server).post('/api/v1/auth/refresh').set('Cookie', `refresh_token=${newRefresh}`).expect(401);
    });

    it('fails without a cookie and clears cookies on failure', async () => {
      const response = await request(t.server).post('/api/v1/auth/refresh').expect(401);
      expect(apiErrorSchema.parse(response.body).code).toBe('UNAUTHORIZED');
      expect(setCookieHeader(response.headers['set-cookie'], 'access_token')).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears both cookies', async () => {
      const user = await createUser(t.prisma);
      const agent = request.agent(t.server);
      await login(agent, user.email);

      const response = await agent.post('/api/v1/auth/logout').expect(204);
      expect(setCookieHeader(response.headers['set-cookie'], 'access_token')).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(setCookieHeader(response.headers['set-cookie'], 'refresh_token')).toMatch(/Expires=Thu, 01 Jan 1970/);

      await agent.get('/api/v1/auth/me').expect(401);
      await agent.post('/api/v1/auth/refresh').expect(401);
    });

    it('logout-all ends every session of the user', async () => {
      const user = await createUser(t.prisma);
      const phone = request.agent(t.server);
      const laptop = request.agent(t.server);
      await login(phone, user.email);
      await login(laptop, user.email);

      await phone.post('/api/v1/auth/logout-all').expect(204);

      await laptop.post('/api/v1/auth/refresh').expect(401);
      expect(await t.prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    });
  });
});

describe('auth throttling', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('limits credential attempts per client', async () => {
    const attempt = () => request(t.server).post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'wrong-pass' });
    await Promise.all(Array.from({ length: 10 }, () => attempt().expect(401)));
    const blocked = await attempt().expect(429);
    expect(apiErrorSchema.parse(blocked.body).code).toBe('TOO_MANY_REQUESTS');
  });
});
