import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import { apiErrorSchema, healthResponseSchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { Public } from '../src/auth/public.decorator.js';
import { configureApp } from '../src/app.setup.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { OPENAPI_JSON_PATH } from '../src/openapi.js';

const signUpSchema = z.object({ email: z.email(), age: z.number().int().min(18) });
class SignUpDto extends createZodDto(signUpSchema) {}

/** Throwaway routes that exercise the global pipe, filter, guard and prefix. */
@Public()
@Controller('_platform')
class PlatformProbeController {
  @Post('validate')
  validate(@Body() body: SignUpDto): SignUpDto {
    return body;
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Nothing here');
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internals');
  }

  @Get('conflict')
  conflict(): never {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
  }

  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @Get('limited')
  limited(): { ok: boolean } {
    return { ok: true };
  }
}

describe('API platform', () => {
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PlatformProbeController],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication<NestExpressApplication>({ bufferLogs: true }));
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('validation (nestjs-zod)', () => {
    it('rejects invalid bodies with a VALIDATION_ERROR envelope and per-field messages', async () => {
      const response = await request(server)
        .post('/api/v1/_platform/validate')
        .send({ email: 'nope', age: 3 })
        .expect(400);

      const error = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(error.fields ?? {})).toEqual(['email', 'age']);
      expect(error.requestId).toMatch(/^[\w.-]+$/);
    });

    it('passes valid bodies through', async () => {
      await request(server)
        .post('/api/v1/_platform/validate')
        .send({ email: 'ok@example.com', age: 30 })
        .expect(201, { email: 'ok@example.com', age: 30 });
    });
  });

  describe('error envelope', () => {
    it('maps HttpExceptions', async () => {
      const response = await request(server).get('/api/v1/_platform/not-found').expect(404);
      expect(apiErrorSchema.parse(response.body)).toMatchObject({ code: 'NOT_FOUND', message: 'Nothing here' });
    });

    it('maps unknown routes', async () => {
      const response = await request(server).get('/api/v1/does-not-exist').expect(404);
      expect(apiErrorSchema.parse(response.body).code).toBe('NOT_FOUND');
    });

    it('hides internals of unexpected errors', async () => {
      const response = await request(server).get('/api/v1/_platform/boom').expect(500);
      const error = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });

    it('maps Prisma unique violations to 409 with the column', async () => {
      const response = await request(server).get('/api/v1/_platform/conflict').expect(409);
      expect(apiErrorSchema.parse(response.body)).toMatchObject({ code: 'CONFLICT', fields: { email: 'Already in use' } });
    });

    it('echoes a well-formed incoming X-Request-Id in header and body', async () => {
      const response = await request(server)
        .get('/api/v1/_platform/not-found')
        .set('x-request-id', 'trace-42')
        .expect(404);

      expect(response.headers['x-request-id']).toBe('trace-42');
      expect(response.body.requestId).toBe('trace-42');
    });
  });

  describe('throttling', () => {
    it('returns TOO_MANY_REQUESTS once a route limit is exceeded', async () => {
      await request(server).get('/api/v1/_platform/limited').expect(200);
      await request(server).get('/api/v1/_platform/limited').expect(200);
      const response = await request(server).get('/api/v1/_platform/limited').expect(429);

      expect(apiErrorSchema.parse(response.body).code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('security headers and CORS', () => {
    it('sets helmet headers', async () => {
      const response = await request(server).get('/health');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('allows the configured web origin with credentials', async () => {
      const response = await request(server)
        .options('/api/v1/_platform/limited')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow other origins', async () => {
      const response = await request(server)
        .options('/api/v1/_platform/limited')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('health and docs', () => {
    it('serves /health outside the API prefix with the database up', async () => {
      const response = await request(server).get('/health').expect(200);
      const health = healthResponseSchema.parse(response.body);

      expect(health.status).toBe('ok');
      expect(health.details.database?.status).toBe('up');
      await request(server).get('/api/v1/health').expect(404);
    });

    it('publishes an OpenAPI document with zod DTOs as component schemas', async () => {
      const response = await request(server).get(`/${OPENAPI_JSON_PATH}`).expect(200);
      const document = response.body as {
        paths: Record<string, unknown>;
        components: { schemas: Record<string, { properties?: Record<string, unknown>; required?: string[] }> };
      };

      expect(document.paths['/api/v1/_platform/validate']).toBeDefined();
      const signUp = document.components.schemas['SignUpDto'];
      expect(Object.keys(signUp?.properties ?? {})).toEqual(['email', 'age']);
      expect(signUp?.required).toEqual(['email', 'age']);
    });
  });
});
