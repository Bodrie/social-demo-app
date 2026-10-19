import { apiErrorSchema, authResponseSchema } from '@the-mesh/shared';
import request from 'supertest';
import { CAPTCHA, CaptchaUnavailableError, type CaptchaVerifier } from '../src/captcha/captcha.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { TEST_PASSWORD } from './setup/factories.js';

/** Stands in for Cloudflare: the test decides the verdict and sees what was asked. */
class FakeCaptcha implements CaptchaVerifier {
  mode: 'pass' | 'fail' | 'down' = 'pass';
  calls: { token: string | undefined; ip: string | undefined }[] = [];

  verify(token: string | undefined, ip: string | undefined): Promise<boolean> {
    this.calls.push({ token, ip });
    if (this.mode === 'down') return Promise.reject(new CaptchaUnavailableError('offline'));
    return Promise.resolve(this.mode === 'pass');
  }
}

let counter = 0;
const member = (captchaToken?: string) => {
  counter += 1;
  return {
    email: `human${counter}@example.com`,
    username: `human${counter}`,
    name: `Human ${counter}`,
    password: TEST_PASSWORD,
    captchaToken,
  };
};

describe('registration bot check', () => {
  let t: TestApp;
  const captcha = new FakeCaptcha();

  beforeAll(async () => {
    t = await createTestApp({
      overrides: (builder) => builder.overrideProvider(CAPTCHA).useValue(captcha),
    });
  });

  beforeEach(() => {
    captcha.mode = 'pass';
    captcha.calls = [];
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('passes the token and the client address to the verifier and registers on success', async () => {
    const body = member('cf-token-1');
    const response = await request(t.server).post('/api/v1/auth/register').send(body).expect(201);

    expect(authResponseSchema.parse(response.body).user.username).toBe(body.username);
    expect(captcha.calls).toEqual([{ token: 'cf-token-1', ip: expect.any(String) }]);
  });

  it('refuses a rejected or missing token on the captcha field, before touching the account', async () => {
    captcha.mode = 'fail';
    const body = member('cf-token-2');
    const response = await request(t.server).post('/api/v1/auth/register').send(body).expect(400);

    const error = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fields).toEqual({ captchaToken: 'Please complete the bot check' });
    expect(await t.prisma.user.count({ where: { email: body.email } })).toBe(0);
  });

  it('answers 503 CAPTCHA_UNAVAILABLE when the check cannot be made, and creates nothing', async () => {
    captcha.mode = 'down';
    const body = member('cf-token-3');
    const response = await request(t.server).post('/api/v1/auth/register').send(body).expect(503);

    const error = apiErrorSchema.parse(response.body);
    expect(error.code).toBe('CAPTCHA_UNAVAILABLE');
    expect(error.message).toMatch(/try again/);
    expect(await t.prisma.user.count({ where: { email: body.email } })).toBe(0);
  });

  it('does not involve the check in signing in', async () => {
    const body = member('cf-token-4');
    await request(t.server).post('/api/v1/auth/register').send(body).expect(201);
    captcha.calls = [];

    await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: TEST_PASSWORD })
      .expect(200);
    expect(captcha.calls).toEqual([]);
  });
});
