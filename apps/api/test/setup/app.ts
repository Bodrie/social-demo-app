import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { resetDatabase } from './database.js';

export type TestApp = { app: NestExpressApplication; prisma: PrismaService; server: App };

/** Boots the real application (same setup as main.ts) against the test database, with empty tables. */
export async function createTestApp(): Promise<TestApp> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleFixture.createNestApplication<NestExpressApplication>({ bufferLogs: true }));
  await app.init();
  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);
  return { app, prisma, server: app.getHttpServer() };
}
