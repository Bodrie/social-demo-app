import argon2 from 'argon2';
import type request from 'supertest';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

export const TEST_PASSWORD = 'Password123!';

let passwordHashPromise: Promise<string> | undefined;
/** argon2 is intentionally slow; hash the shared test password once per worker. */
export function testPasswordHash(): Promise<string> {
  passwordHashPromise ??= argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  return passwordHashPromise;
}

let counter = 0;

export type CreatedUser = { id: string; email: string; username: string; name: string };

export async function createUser(
  prisma: PrismaService,
  overrides: Partial<{
    email: string;
    username: string;
    name: string;
    bio: string;
    city: string;
    /** Factory users are verified unless a test says otherwise. */
    emailVerifiedAt: Date | null;
  }> = {},
): Promise<CreatedUser> {
  counter += 1;
  return prisma.user.create({
    data: {
      email: `user${counter}@example.com`,
      username: `user${counter}`,
      name: `User ${counter}`,
      passwordHash: await testPasswordHash(),
      emailVerifiedAt: new Date(),
      ...overrides,
    },
    select: { id: true, email: true, username: true, name: true },
  });
}

export type TestAgent = ReturnType<typeof request.agent>;

/** Logs the agent in (cookies are kept by the agent). */
export async function login(
  agent: TestAgent,
  email: string,
  password = TEST_PASSWORD,
): Promise<void> {
  await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
}

/** Parses Set-Cookie headers into { name: value }. */
export function cookiesFrom(setCookie: string | string[] | undefined): Record<string, string> {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookies: Record<string, string> = {};
  for (const header of headers) {
    const [pair] = header.split(';');
    const index = pair?.indexOf('=') ?? -1;
    if (pair && index > 0) cookies[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return cookies;
}

/** Raw Set-Cookie header for one cookie name (to inspect attributes). */
export function setCookieHeader(
  setCookie: string | string[] | undefined,
  name: string,
): string | undefined {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return headers.find((header) => header.startsWith(`${name}=`));
}
