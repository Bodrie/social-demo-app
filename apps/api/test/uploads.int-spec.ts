import { apiErrorSchema, uploadResponseSchema, userPrivateSchema } from '@the-mesh/shared';
import sharp from 'sharp';
import request from 'supertest';
import { type TestApp, createTestApp } from './setup/app.js';
import { type TestAgent, createUser, login } from './setup/factories.js';

function png(width = 640, height = 480): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#aa3366' } }).png().toBuffer();
}

describe('uploads', () => {
  let t: TestApp;
  let agent: TestAgent;

  beforeAll(async () => {
    t = await createTestApp();
    const user = await createUser(t.prisma);
    agent = request.agent(t.server);
    await login(agent, user.email);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('requires a session', async () => {
    await request(t.server).post('/api/v1/uploads?kind=avatar').attach('file', await png(), 'a.png').expect(401);
  });

  it('stores an avatar as WebP and serves it back immutable', async () => {
    const response = await agent.post('/api/v1/uploads?kind=avatar').attach('file', await png(), 'me.png').expect(201);
    const upload = uploadResponseSchema.parse(response.body);

    expect(upload.key).toMatch(/^avatar\//);
    expect([upload.width, upload.height]).toEqual([512, 512]);
    expect(upload.url.endsWith(`/api/v1/uploads/${upload.key}`)).toBe(true);

    const served = await request(t.server).get(`/api/v1/uploads/${upload.key}`).expect(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await sharp(served.body as Buffer).metadata()).format).toBe('webp');
  });

  it('validates the kind and requires a file', async () => {
    const badKind = await agent.post('/api/v1/uploads?kind=banner').attach('file', await png(), 'a.png').expect(400);
    expect(apiErrorSchema.parse(badKind.body).fields).toHaveProperty('kind');

    const noFile = await agent.post('/api/v1/uploads?kind=post').expect(400);
    expect(apiErrorSchema.parse(noFile.body).fields).toEqual({ file: 'A file is required' });
  });

  it('rejects non-images regardless of filename and declared type', async () => {
    const response = await agent
      .post('/api/v1/uploads?kind=post')
      .attach('file', Buffer.from('<html>not an image</html>'), { filename: 'evil.png', contentType: 'image/png' })
      .expect(415);

    expect(apiErrorSchema.parse(response.body).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects files above the size limit', async () => {
    const response = await agent
      .post('/api/v1/uploads?kind=post')
      .attach('file', Buffer.alloc(6 * 1024 * 1024, 1), 'huge.png')
      .expect(413);

    expect(apiErrorSchema.parse(response.body).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('404s on unknown files and refuses path tricks', async () => {
    await request(t.server).get('/api/v1/uploads/avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp').expect(404);
    const traversal = await request(t.server).get('/api/v1/uploads/avatar/..%2F..%2F.env').expect(400);
    expect(apiErrorSchema.parse(traversal.body).code).toBe('VALIDATION_ERROR');
  });

  describe('profile pictures', () => {
    it('links an uploaded avatar to the profile and drops the previous file', async () => {
      const first = uploadResponseSchema.parse(
        (await agent.post('/api/v1/uploads?kind=avatar').attach('file', await png(), 'one.png').expect(201)).body,
      );
      const second = uploadResponseSchema.parse(
        (await agent.post('/api/v1/uploads?kind=avatar').attach('file', await png(), 'two.png').expect(201)).body,
      );

      const withFirst = userPrivateSchema.parse((await agent.patch('/api/v1/users/me').send({ avatarKey: first.key }).expect(200)).body);
      expect(withFirst.avatarUrl).toBe(first.url);

      const withSecond = userPrivateSchema.parse((await agent.patch('/api/v1/users/me').send({ avatarKey: second.key }).expect(200)).body);
      expect(withSecond.avatarUrl).toBe(second.url);
      await request(t.server).get(`/api/v1/uploads/${first.key}`).expect(404);
      await request(t.server).get(`/api/v1/uploads/${second.key}`).expect(200);

      const cleared = userPrivateSchema.parse((await agent.patch('/api/v1/users/me').send({ avatarKey: null }).expect(200)).body);
      expect(cleared.avatarUrl).toBeNull();
      await request(t.server).get(`/api/v1/uploads/${second.key}`).expect(404);
    });

    it('refuses keys that were never uploaded', async () => {
      const response = await agent
        .patch('/api/v1/users/me')
        .send({ coverKey: 'cover/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp' })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).fields).toEqual({ coverKey: 'Unknown upload' });
    });
  });
});
