import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { resetDatabase } from './database.js';

export type TestApp = { app: NestExpressApplication; prisma: PrismaService; server: App; baseUrl: string };

/**
 * Boots the real application (same setup as main.ts) against the test database,
 * with empty tables. With `listen`, the app binds an ephemeral port so socket.io
 * clients can connect; supertest works either way.
 */
export async function createTestApp(options: { listen?: boolean } = {}): Promise<TestApp> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleFixture.createNestApplication<NestExpressApplication>({ bufferLogs: true }));
  let baseUrl = '';
  if (options.listen) {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  } else {
    await app.init();
  }
  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);
  return { app, prisma, server: app.getHttpServer(), baseUrl };
}
