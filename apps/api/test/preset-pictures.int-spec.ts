import { apiErrorSchema, meResponseSchema, uploadResponseSchema } from '@beso/shared';
import sharp from 'sharp';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';

const PRESET = '/api/v1/uploads/preset';

describe('ready-made pictures', () => {
  let t: TestApp;
  let member: CreatedUser;
  let agent: TestAgent;

  const me = async () =>
    meResponseSchema.parse((await agent.get('/api/v1/auth/me').expect(200)).body).user;
  const patch = (body: object, status = 200) =>
    agent.patch('/api/v1/users/me').send(body).expect(status);

  beforeAll(async () => {
    t = await createTestApp();
    member = await createUser(t.prisma);
    agent = request.agent(t.server);
    await login(agent, member.email);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('are served from the API, only the ones in the catalogue', async () => {
    const response = await request(t.server).get(`${PRESET}/avatar-sunny.webp`).expect(200);
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['cache-control']).toBe('public, max-age=86400');
    await request(t.server).get(`${PRESET}/cover-gold.webp`).expect(200);
    await request(t.server).get(`${PRESET}/avatar-nobody.webp`).expect(404);
    await request(t.server).get(`${PRESET}/../package.json`).expect(404);
    await request(t.server).get(`${PRESET}/AVATAR-sunny.webp`).expect(400);
  });

  it('take the place of an upload and give it back, and count as one’s picture', async () => {
    await patch({ avatarPreset: 'sunny', coverPreset: 'ocean' });
    let user = await me();
    expect(user).toMatchObject({ avatarPreset: 'sunny', coverPreset: 'ocean' });
    expect(user.avatarUrl).toMatch(/\/uploads\/preset\/avatar-sunny\.webp$/);
    expect(user.coverUrl).toMatch(/\/uploads\/preset\/cover-ocean\.webp$/);
    const earned = await t.prisma.userAchievement.findMany({
      where: { userId: member.id, key: { in: ['profile-picture', 'cover-photo'] } },
    });
    expect(earned).toHaveLength(2);

    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#357' },
    })
      .png()
      .toBuffer();
    const upload = uploadResponseSchema.parse(
      (await agent.post('/api/v1/uploads?kind=avatar').attach('file', image, 'me.png').expect(201))
        .body,
    );
    await patch({ avatarKey: upload.key });
    user = await me();
    expect(user.avatarPreset).toBeNull();
    expect(user.avatarUrl).toBe(upload.url);

    // Back to a ready-made one: the upload nobody uses any more goes.
    await patch({ avatarPreset: 'kai' });
    user = await me();
    expect(user.avatarPreset).toBe('kai');
    expect(await t.prisma.upload.count({ where: { key: upload.key } })).toBe(0);

    await patch({ avatarPreset: null, avatarKey: null });
    expect((await me()).avatarUrl).toBeNull();
  });

  it('refuse unknown ones and those a badge not yet earned unlocks', async () => {
    const fields = async (body: object) =>
      apiErrorSchema.parse((await patch(body, 400)).body).fields;
    expect(await fields({ avatarPreset: 'nobody' })).toEqual({ avatarPreset: 'Unknown picture' });
    expect(await fields({ coverPreset: 'gold' })).toEqual({
      coverPreset: 'Earn the badge that unlocks it first',
    });
    await t.prisma.userAchievement.create({ data: { userId: member.id, key: 'collected-50' } });
    await patch({ coverPreset: 'gold' });
    expect((await me()).coverPreset).toBe('gold');
  });

  it('can be picked on the registration form, the free ones only', async () => {
    const register = (avatarPreset: string, n: number) =>
      request(t.server)
        .post('/api/v1/auth/register')
        .send({
          email: `preset${n}@example.com`,
          username: `preset${n}`,
          name: 'Preset Person',
          password: 'Password123!',
          avatarPreset,
        });
    const locked = await register('shades', 1).expect(400);
    expect(apiErrorSchema.parse(locked.body).fields).toEqual({
      avatarPreset: 'Earn the badge that unlocks it first',
    });
    await register('maya', 2).expect(201);
    const created = await t.prisma.user.findUnique({
      where: { username: 'preset2' },
      select: { avatarPreset: true },
    });
    expect(created?.avatarPreset).toBe('maya');
  });
});
