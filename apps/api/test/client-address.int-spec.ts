import { ConfigService } from '@nestjs/config';
import { apiErrorSchema, sessionListSchema } from '@beso/shared';
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import request from 'supertest';
import { CREDENTIAL_THROTTLE } from '../src/auth/credential-throttle.js';
import type { Env } from '../src/config/env.js';
import { pinoHttpOptions } from '../src/logging/logger.module.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { TEST_PASSWORD, createUser } from './setup/factories.js';

// Production runs behind Caddy with TRUST_PROXY=1 (deploy/docker-compose.yml). It is set
// before the app module loads, because ConfigModule validates the environment on import.
const previousTrustProxy = vi.hoisted(() => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = '1';
  return previous;
});

/**
 * What reaches the API behind Caddy (apps/web/docker/Caddyfile, checked against Caddy 2.11):
 * a request through Cloudflare carries `X-Forwarded-For: <CF-Connecting-IP>`, whatever the
 * client sent itself; one made on the box without Cloudflare carries an empty header. The
 * socket peer is always Caddy. Review L26: the request log used to record that peer.
 */
describe('the client address behind the proxy', () => {
  let t: TestApp;
  const logLines: { req?: Record<string, unknown> }[] = [];

  beforeAll(async () => {
    // The real request logging, with its lines collected here instead of written to stdout.
    t = await createTestApp({
      overrides: (builder) =>
        builder.overrideProvider(PARAMS_PROVIDER_TOKEN).useFactory({
          inject: [ConfigService],
          factory: (config: ConfigService<Env, true>) => ({
            pinoHttp: [
              { ...pinoHttpOptions(config), level: 'info' },
              { write: (line: string) => logLines.push(JSON.parse(line) as never) },
            ],
          }),
        }),
    });
  });

  afterAll(async () => {
    await t.app.close();
    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrustProxy;
  });

  /** The request line pino-http wrote for `url` (written when the response finished). */
  async function loggedRequest(url: string): Promise<Record<string, unknown>> {
    let line: Record<string, unknown> | undefined;
    await vi.waitFor(() => {
      line = logLines.find((entry) => entry.req?.url === url)?.req;
      expect(line).toBeDefined();
    });
    return line ?? {};
  }

  it('logs the visitor Caddy names, IPv4 or IPv6, and never the socket peer', async () => {
    await request(t.server)
      .get('/api/v1/auth/me?probe=v4')
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(401);
    await request(t.server)
      .get('/api/v1/auth/me?probe=v6')
      .set('X-Forwarded-For', '2001:db8::1')
      .expect(401);

    const v4 = await loggedRequest('/api/v1/auth/me?probe=v4');
    expect(v4).toMatchObject({ method: 'GET', ip: '203.0.113.7' });
    expect(v4).not.toHaveProperty('remoteAddress');
    expect(await loggedRequest('/api/v1/auth/me?probe=v6')).toMatchObject({ ip: '2001:db8::1' });
  });

  it('trusts exactly one hop: an address put in front of the proxy entry is ignored', async () => {
    await request(t.server)
      .get('/api/v1/auth/me?probe=chain')
      .set('X-Forwarded-For', '198.51.100.66, 203.0.113.9')
      .expect(401);
    expect(await loggedRequest('/api/v1/auth/me?probe=chain')).toMatchObject({
      ip: '203.0.113.9',
    });
  });

  it('falls back to the peer, not an empty address, for a request made on the box itself', async () => {
    await request(t.server)
      .get('/api/v1/auth/me?probe=local')
      .set('X-Forwarded-For', '')
      .expect(401);
    const { ip } = await loggedRequest('/api/v1/auth/me?probe=local');
    expect(ip).toMatch(/^(?:::ffff:)?127\.0\.0\.1$|^::1$/);
  });

  it('records the visitor with the session, masked in the sessions list', async () => {
    const user = await createUser(t.prisma);
    const agent = request.agent(t.server);
    await agent
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.7')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    const sessions = sessionListSchema.parse(
      (await agent.get('/api/v1/auth/sessions').expect(200)).body,
    );
    expect(sessions.items.map((session) => session.ip)).toEqual(['203.0.113.x']);
  });

  it('throttles sign-in attempts per visitor, so one of them cannot lock others out', async () => {
    const attempt = (address: string) =>
      request(t.server)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', address)
        .send({ email: 'victim@example.com', password: 'wrong-pass' });

    for (let i = 0; i < CREDENTIAL_THROTTLE.perAccount.limit; i += 1) {
      // oxlint-disable-next-line no-await-in-loop -- sequential on purpose
      await attempt('198.51.100.20').expect(401);
    }
    expect(apiErrorSchema.parse((await attempt('198.51.100.20').expect(429)).body).code).toBe(
      'TOO_MANY_REQUESTS',
    );
    // Behind the proxy every request comes from Caddy: keyed by the peer, this would be a 429.
    await attempt('198.51.100.21').expect(401);
  });

  it('counts an IPv6 network (/64) as one visitor for the per-account limit too', async () => {
    const attempt = (address: string) =>
      request(t.server)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', address)
        .send({ email: 'target6@example.com', password: 'wrong-pass' });

    // A fresh address from the same /64 for every attempt.
    for (let i = 1; i <= CREDENTIAL_THROTTLE.perAccount.limit; i += 1) {
      // oxlint-disable-next-line no-await-in-loop -- sequential on purpose
      await attempt(`2001:db8:0:7::${i.toString(16)}`).expect(401);
    }
    await attempt('2001:db8:0:7::ffff').expect(429);
    // Another network has a budget of its own.
    await attempt('2001:db8:0:8::1').expect(401);
  });
});
