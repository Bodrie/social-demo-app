import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { healthResponseSchema } from '@the-mesh/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/database.js';

describe('app bootstrap', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responds with a payload matching the shared schema', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(healthResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it('reaches the database through PrismaService', async () => {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;

    expect(rows[0]?.ok).toBe(1);
    expect(await prisma.user.count()).toBe(0);
  });
});
