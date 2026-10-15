/**
 * Development / e2e seed. Deterministic (faker seeded) and destructive:
 * it truncates every table before inserting. Run with `pnpm db:seed`.
 *
 * Fixed accounts (password for all: Password123!):
 *   alice@example.com (alice), bob@example.com (bob), carol@example.com (carol)
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { faker } from '@faker-js/faker';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ActivityType } from '../src/generated/prisma/enums.js';
import { TABLES } from '../src/prisma/tables.js';
import { placeholderAvatar, placeholderPostImage } from './placeholders.js';

const FAKER_SEED = 20261015;
const FAKE_USER_COUNT = 20;
export const SEED_PASSWORD = 'Password123!';

export const FIXED_USERS = [
  { email: 'alice@example.com', username: 'alice', name: 'Alice Anderson', city: 'Sofia' },
  { email: 'bob@example.com', username: 'bob', name: 'Bob Brown', city: 'Plovdiv' },
  { email: 'carol@example.com', username: 'carol', name: 'Carol Clark', city: 'Varna' },
] as const;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads');

/** Writes a generated file into the uploads dir, records its owner, and returns the storage key. */
async function seedFile(kind: 'avatar' | 'post', ownerId: string, data: Buffer): Promise<string> {
  const key = `${kind}/${randomUUID()}.webp`;
  const file = path.join(uploadsDir, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  await prisma.upload.create({ data: { key, ownerId, kind } });
  return key;
}

/** Usernames must satisfy the shared rule (lowercase letters, digits, underscores) and be unique. */
function seedUsername(raw: string, taken: Set<string>): string {
  const base =
    raw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 27) || 'user';
  let candidate = base;
  let suffix = 1;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
  taken.add(candidate);
  return candidate;
}

function pick<T>(items: readonly T[], count: number): T[] {
  return faker.helpers.arrayElements(items, count);
}

async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
  );
  // Generated files from previous runs are orphans once their rows are gone.
  await Promise.all(
    ['avatar', 'post'].map((kind) =>
      rm(path.join(uploadsDir, kind), { recursive: true, force: true }),
    ),
  );
}

async function seed(): Promise<void> {
  faker.seed(FAKER_SEED);
  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });

  await truncateAll();

  // --- users -------------------------------------------------------------
  const takenUsernames = new Set<string>(FIXED_USERS.map((u) => u.username));
  const fakeUsers = Array.from({ length: FAKE_USER_COUNT }, () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      username: seedUsername(faker.internet.username({ firstName, lastName }), takenUsernames),
      name: `${firstName} ${lastName}`,
      city: faker.location.city(),
      bio: faker.helpers.maybe(() => faker.person.bio(), { probability: 0.7 }) ?? null,
      website: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.3 }) ?? null,
    };
  });

  const users = await prisma.user.createManyAndReturn({
    data: [...FIXED_USERS.map((u) => ({ ...u, bio: null, website: null })), ...fakeUsers].map(
      (u) => ({ ...u, passwordHash }),
    ),
    select: { id: true, username: true },
  });
  const userIds = users.map((u) => u.id);

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarKey: await seedFile(
          'avatar',
          user.id,
          await placeholderAvatar(user.username, user.id),
        ),
      },
    });
  }

  await prisma.activity.createMany({
    data: userIds.map((actorId) => ({ actorId, type: ActivityType.USER_REGISTERED })),
  });

  // --- follows -----------------------------------------------------------
  const follows = userIds.flatMap((followerId) =>
    pick(
      userIds.filter((id) => id !== followerId),
      faker.number.int({ min: 3, max: 8 }),
    ).map((followeeId) => ({ followerId, followeeId })),
  );
  await prisma.follow.createMany({ data: follows, skipDuplicates: true });
  await prisma.activity.createMany({
    data: follows.map((f) => ({
      actorId: f.followerId,
      type: ActivityType.USER_FOLLOWED,
      targetUserId: f.followeeId,
    })),
  });

  // --- posts -------------------------------------------------------------
  const posts = await prisma.post.createManyAndReturn({
    data: userIds.flatMap((authorId) =>
      Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
        authorId,
        content: faker.lorem.paragraph({ min: 1, max: 3 }).slice(0, 500),
        createdAt: faker.date.recent({ days: 30 }),
      })),
    ),
    select: { id: true, authorId: true, createdAt: true },
  });
  for (const post of posts) {
    if (faker.number.int({ min: 1, max: 10 }) <= 3) {
      const image = await placeholderPostImage(faker.word.words(2), post.id);
      await prisma.post.update({
        where: { id: post.id },
        data: { imageKey: await seedFile('post', post.authorId, image) },
      });
    }
  }
  await prisma.activity.createMany({
    data: posts.map((p) => ({
      actorId: p.authorId,
      type: ActivityType.POST_CREATED,
      postId: p.id,
      createdAt: p.createdAt,
    })),
  });

  // --- likes -------------------------------------------------------------
  const likes = posts.flatMap((post) =>
    pick(
      userIds.filter((id) => id !== post.authorId),
      faker.number.int({ min: 0, max: 6 }),
    ).map((userId) => ({ userId, postId: post.id })),
  );
  await prisma.postLike.createMany({ data: likes, skipDuplicates: true });
  await prisma.activity.createMany({
    data: likes.map((l) => ({
      actorId: l.userId,
      type: ActivityType.POST_LIKED,
      postId: l.postId,
    })),
  });

  // --- comments ----------------------------------------------------------
  const comments = await prisma.comment.createManyAndReturn({
    data: posts.flatMap((post) =>
      Array.from({ length: faker.number.int({ min: 0, max: 4 }) }, () => ({
        postId: post.id,
        authorId: faker.helpers.arrayElement(userIds),
        content: faker.lorem.sentence(),
        createdAt: faker.date.between({ from: post.createdAt, to: new Date() }),
      })),
    ),
    select: { id: true, authorId: true, postId: true, createdAt: true },
  });
  await prisma.activity.createMany({
    data: comments.map((c) => ({
      actorId: c.authorId,
      type: ActivityType.COMMENT_CREATED,
      postId: c.postId,
      commentId: c.id,
      createdAt: c.createdAt,
    })),
  });

  // --- messages between the fixed accounts ---------------------------------
  const [alice, bob] = users;
  if (alice && bob) {
    await prisma.message.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        senderId: i % 2 === 0 ? alice.id : bob.id,
        recipientId: i % 2 === 0 ? bob.id : alice.id,
        content: faker.lorem.sentence(),
        createdAt: new Date(Date.now() - (12 - i) * 60_000),
        readAt: i < 10 ? new Date() : null,
      })),
    });
  }

  console.log(
    `Seeded ${users.length} users (avatars in ${uploadsDir}), ${follows.length} follows, ${posts.length} posts, ${likes.length} likes, ${comments.length} comments.`,
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
