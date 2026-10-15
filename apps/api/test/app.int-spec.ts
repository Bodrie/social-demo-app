import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { healthResponseSchema } from '@the-mesh/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('GET /health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds with a payload matching the shared schema', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(healthResponseSchema.safeParse(response.body).success).toBe(true);
  });
});
