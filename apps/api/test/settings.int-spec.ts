import { apiErrorSchema, authResponseSchema } from '@beso/shared';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type TestAgent, createUser, login } from './setup/factories.js';

describe('PATCH /users/me/settings', () => {
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

  it('starts with the defaults, merges a partial patch and keeps it', async () => {
    const before = authResponseSchema.parse((await agent.get('/api/v1/auth/me').expect(200)).body);
    expect(before.user.settings).toEqual({
      chatBubbles: true,
      messageSound: false,
      browserNotifications: false,
      pushMessages: true,
      pushSocial: true,
      pushPreviews: true,
      showAchievements: true,
      hideGettingStarted: false,
      timeZone: null,
    });

    const patched = authResponseSchema.parse(
      (await agent.patch('/api/v1/users/me/settings').send({ chatBubbles: false }).expect(200))
        .body,
    );
    expect(patched.user.settings).toEqual({
      chatBubbles: false,
      messageSound: false,
      browserNotifications: false,
      pushMessages: true,
      pushSocial: true,
      pushPreviews: true,
      showAchievements: true,
      hideGettingStarted: false,
      timeZone: null,
    });

    const after = authResponseSchema.parse((await agent.get('/api/v1/auth/me').expect(200)).body);
    expect(after.user.settings.chatBubbles).toBe(false);
    const again = authResponseSchema.parse(
      (await agent.patch('/api/v1/users/me/settings').send({ messageSound: true }).expect(200))
        .body,
    );
    expect(again.user.settings).toEqual({
      chatBubbles: false,
      messageSound: true,
      browserNotifications: false,
      pushMessages: true,
      pushSocial: true,
      pushPreviews: true,
      showAchievements: true,
      hideGettingStarted: false,
      timeZone: null,
    });
  });

  it('refuses a wrong type on the field and ignores keys it does not know', async () => {
    const wrong = await agent
      .patch('/api/v1/users/me/settings')
      .send({ chatBubbles: 'no' })
      .expect(400);
    expect(apiErrorSchema.parse(wrong.body).fields).toHaveProperty('chatBubbles');
    const unknown = authResponseSchema.parse(
      (await agent.patch('/api/v1/users/me/settings').send({ theme: 'dark' }).expect(200)).body,
    );
    expect(unknown.user.settings).not.toHaveProperty('theme');
  });
});
