import { apiErrorSchema } from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type TestAgent, createUser, login } from './setup/factories.js';

const MISSING = '01a13ed6-d3ec-71cb-b39f-fbc256a29000';

/** Routes whose refusals had no test (review 2026-10-19, coverage §5). */
describe('error paths', () => {
  let t: TestApp;
  let agent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    const me = await createUser(t.prisma);
    agent = request.agent(t.server);
    await login(agent, me.email);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('404s on an unknown username and on the revisions of an unknown post', async () => {
    const user = await agent.get('/api/v1/users/by-username/nobody_here').expect(404);
    expect(apiErrorSchema.parse(user.body).code).toBe('NOT_FOUND');
    const revisions = await agent.get(`/api/v1/posts/${MISSING}/revisions`).expect(404);
    expect(apiErrorSchema.parse(revisions.body).code).toBe('NOT_FOUND');
  });

  it('404s when clearing a reaction on an unknown comment', async () => {
    const response = await agent.delete(`/api/v1/comments/${MISSING}/reaction`).expect(404);
    expect(apiErrorSchema.parse(response.body).code).toBe('NOT_FOUND');
  });

  it('400s on malformed query parameters, keyed by the parameter', async () => {
    const trending = await agent.get('/api/v1/tags/trending?limit=x').expect(400);
    expect(apiErrorSchema.parse(trending.body).fields).toHaveProperty('limit');
    const suggestions = await agent.get('/api/v1/users/suggestions?limit=0').expect(400);
    expect(apiErrorSchema.parse(suggestions.body).fields).toHaveProperty('limit');
    const activities = await agent.get('/api/v1/activities?cursor=garbage').expect(400);
    expect(apiErrorSchema.parse(activities.body).fields).toHaveProperty('cursor');
  });

  it('signs out cleanly without a refresh cookie', async () => {
    await request(t.server).post('/api/v1/auth/logout').expect(204);
  });
});
