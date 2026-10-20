import { existsSync } from 'node:fs';
import path from 'node:path';
import { SchedulerRegistry } from '@nestjs/schedule';
import { uploadResponseSchema } from '@beso/shared';
import sharp from 'sharp';
import request from 'supertest';
import { EmailTokensService } from '../src/auth/email-tokens.service.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { type TestApp, createTestApp } from './setup/app.js';
import { type CreatedUser, type TestAgent, createUser, login } from './setup/factories.js';
import { readOutbox, tokenIn, waitForEmail } from './setup/outbox.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** The jobs' clock: a minute ahead of the rows the tests create, so those count as fresh. */
const now = new Date(Date.now() + 60_000);
const ago = (ms: number): Date => new Date(now.getTime() - ms);

const fileOf = (key: string): string => path.join(process.env.UPLOADS_DIR ?? '', key);

async function agentFor(t: TestApp, user: CreatedUser): Promise<TestAgent> {
  const agent = request.agent(t.server);
  await login(agent, user.email);
  return agent;
}

async function uploadPicture(agent: TestAgent): Promise<string> {
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#333' } })
    .png()
    .toBuffer();
  const response = await agent
    .post('/api/v1/uploads?kind=post')
    .attach('file', image, 'pic.png')
    .expect(201);
  return uploadResponseSchema.parse(response.body).key;
}

describe('daily jobs', () => {
  let t: TestApp;
  let jobs: JobsService;

  const registered = async (user: CreatedUser, daysAgo: number): Promise<void> => {
    await t.prisma.user.update({ where: { id: user.id }, data: { createdAt: ago(daysAgo * DAY) } });
  };

  beforeAll(async () => {
    t = await createTestApp();
    jobs = t.app.get(JobsService);
  });

  afterAll(async () => {
    await t.app.close();
  });

  // JOBS_ENABLED=false in the test environment: the clock below is the only one that runs them.
  it('runs on no timer in tests', () => {
    expect(t.app.get(SchedulerRegistry).getCronJobs().size).toBe(0);
  });

  it('removes uploads nobody attached within a day, rows and files', async () => {
    const alice = await createUser(t.prisma);
    const agent = await agentFor(t, alice);
    const orphan = await uploadPicture(agent);
    const attached = await uploadPicture(agent);
    const fresh = await uploadPicture(agent);
    await agent.post('/api/v1/posts').send({ content: 'with a picture', imageKey: attached });
    await t.prisma.upload.updateMany({
      where: { key: { in: [orphan, attached] } },
      data: { createdAt: ago(25 * HOUR) },
    });

    await jobs.runDaily(now);

    const rows = await t.prisma.upload.findMany({ where: { ownerId: alice.id } });
    expect(rows.map((row) => row.key).toSorted()).toEqual([attached, fresh].toSorted());
    expect(existsSync(fileOf(orphan))).toBe(false);
    expect(existsSync(fileOf(attached))).toBe(true);
    expect(existsSync(fileOf(fresh))).toBe(true);
  });

  it('drops expired tokens and keeps the live and the rotated ones', async () => {
    const user = await createUser(t.prisma);
    const hash = (raw: string): string => t.app.get(EmailTokensService).hash(raw);
    await t.prisma.emailToken.createMany({
      data: [
        { userId: user.id, kind: 'verify_email', tokenHash: hash('gone'), expiresAt: ago(1) },
        { userId: user.id, kind: 'password_reset', tokenHash: hash('live'), expiresAt: ago(-HOUR) },
      ],
    });
    await t.prisma.refreshToken.createMany({
      data: [
        { userId: user.id, tokenHash: hash('r-gone'), expiresAt: ago(1) },
        { userId: user.id, tokenHash: hash('r-live'), expiresAt: ago(-DAY) },
        // Rotated tokens are what reuse detection looks for: they stay until they expire.
        {
          userId: user.id,
          tokenHash: hash('r-rotated'),
          expiresAt: ago(-DAY),
          revokedAt: ago(HOUR),
        },
      ],
    });

    await jobs.runDaily(now);

    const emailTokens = await t.prisma.emailToken.findMany({ where: { userId: user.id } });
    expect(emailTokens.map((token) => token.tokenHash)).toEqual([hash('live')]);
    const refreshTokens = await t.prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(refreshTokens.map((token) => token.tokenHash).toSorted()).toEqual(
      [hash('r-live'), hash('r-rotated')].toSorted(),
    );
  });

  it('forgets notifications older than ninety days, read or not', async () => {
    const member = await createUser(t.prisma);
    const fan = await createUser(t.prisma);
    await t.prisma.notification.createMany({
      data: [
        { userId: member.id, type: 'USER_FOLLOWED', actorId: fan.id, createdAt: ago(91 * DAY) },
        {
          userId: fan.id,
          type: 'USER_FOLLOWED',
          actorId: member.id,
          createdAt: ago(89 * DAY),
          readAt: ago(88 * DAY),
        },
      ],
    });

    await jobs.runDaily(now);

    const left = await t.prisma.notification.findMany({
      where: { userId: { in: [member.id, fan.id] } },
    });
    expect(left.map((row) => row.userId)).toEqual([fan.id]);
  });

  it('warns an unconfirmed account once, with a working link and the removal date', async () => {
    const waiting = await createUser(t.prisma, { emailVerifiedAt: null });
    const young = await createUser(t.prisma, { emailVerifiedAt: null });
    const member = await createUser(t.prisma);
    await registered(waiting, 24);
    await registered(young, 10);
    await registered(member, 40);

    await jobs.runDaily(now);

    const mail = await waitForEmail(waiting.email, /account will be removed/);
    const removalDate = ago(24 * DAY - 30 * DAY).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    expect(mail.text).toContain(`will be removed after ${removalDate}`);
    const row = await t.prisma.user.findUniqueOrThrow({
      where: { id: waiting.id },
      select: { expiryWarnedAt: true },
    });
    expect(row.expiryWarnedAt).toEqual(now);
    await request(t.server)
      .post('/api/v1/auth/verify-email')
      .send({ token: tokenIn(mail) })
      .expect(200);

    // The next day nobody is warned twice, and the young and the confirmed accounts hear nothing.
    await jobs.runDaily(new Date(now.getTime() + DAY));
    const outbox = await readOutbox();
    expect(outbox.filter((entry) => entry.to === waiting.email)).toHaveLength(1);
    expect(outbox.filter((entry) => [young.email, member.email].includes(entry.to))).toEqual([]);
  });

  it('erases an account still unconfirmed after thirty days, its threads with it, without a mail', async () => {
    const stale = await createUser(t.prisma, { emailVerifiedAt: null });
    await registered(stale, 31);
    const other = await createUser(t.prisma);
    const agent = await agentFor(t, other);
    const thread = await agent.put(`/api/v1/conversations/direct/${stale.id}`).expect(200);
    await agent
      .post(`/api/v1/conversations/${thread.body.id}/messages`)
      .send({ content: 'Are you there?' })
      .expect(201);

    await jobs.runDaily(now);

    expect(await t.prisma.user.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await t.prisma.conversation.findUnique({ where: { id: thread.body.id } })).toBeNull();
    expect((await readOutbox()).filter((entry) => entry.to === stale.email)).toEqual([]);
    expect(await t.prisma.user.findUnique({ where: { id: other.id } })).not.toBeNull();
  });
});
