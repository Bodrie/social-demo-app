import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Throttle } from '@nestjs/throttler';
import { apiErrorSchema, healthResponseSchema } from '@beso/shared';
import { ZodResponse, createZodDto } from 'nestjs-zod';
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
class ProbeAnswerDto extends createZodDto(z.object({ name: z.string(), count: z.int() })) {}

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

  @Get('shaped')
  @ZodResponse({ status: 200, type: ProbeAnswerDto })
  shaped(): { name: string; count: number } {
    // The extra key stands for anything a service selects that the contract does not carry.
    return { name: 'probe', count: 2, passwordHash: 'never leaves' } as {
      name: string;
      count: number;
    };
  }

  @Get('misshaped')
  @ZodResponse({ status: 200, type: ProbeAnswerDto })
  misshaped(): { name: string; count: number } {
    return { name: 'probe', count: 'two' } as unknown as { name: string; count: number };
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

    app = configureApp(
      moduleFixture.createNestApplication<NestExpressApplication>({ bufferLogs: true }),
    );
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('origin check (CSRF)', () => {
    it('refuses state-changing requests from a page we did not serve, before validation runs', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: 'a@b.c', password: 'x' })
        .expect(403);
      expect(apiErrorSchema.parse(response.body)).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Cross-origin request refused',
      });
    });

    it('lets the web origin, the API host and non-browser clients through', async () => {
      // 400 = the body parser and validation ran, so the check passed.
      await request(server)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({})
        .expect(400);
      await request(server)
        .post('/api/v1/auth/login')
        .set('Host', 'api.test:3000')
        .set('Origin', 'https://api.test:3000')
        .send({})
        .expect(400);
      await request(server).post('/api/v1/auth/login').send({}).expect(400);
    });

    it('never touches safe methods', async () => {
      await request(server).get('/health').set('Origin', 'https://evil.example').expect(200);
    });
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
      expect(apiErrorSchema.parse(response.body)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Nothing here',
      });
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
      expect(apiErrorSchema.parse(response.body)).toMatchObject({
        code: 'CONFLICT',
        fields: { email: 'Already in use' },
      });
    });

    it('maps body-parser limits to the envelope instead of a masked 500', async () => {
      const response = await request(server)
        .post('/api/v1/_platform/validate')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'ok@example.com', age: 30, padding: 'x'.repeat(200_000) }))
        .expect(413);
      expect(apiErrorSchema.parse(response.body).code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('replaces malformed incoming request ids instead of echoing them', async () => {
      const response = await request(server)
        .get('/api/v1/_platform/not-found')
        .set('x-request-id', '<script>alert(1)</script>')
        .expect(404);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
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

  describe('response contract (@ZodResponse)', () => {
    it('answers only the keys of the declared schema', async () => {
      const response = await request(server).get('/api/v1/_platform/shaped').expect(200);
      expect(response.body).toEqual({ name: 'probe', count: 2 });
    });

    it('turns an answer that breaks its schema into a masked 500, not a client error', async () => {
      const response = await request(server).get('/api/v1/_platform/misshaped').expect(500);
      const error = apiErrorSchema.parse(response.body);
      expect(error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
      expect(error.fields).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('count');
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
        openapi: string;
        paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
        components: {
          schemas: Record<string, { properties?: Record<string, unknown>; required?: string[] }>;
        };
      };

      expect(document.paths['/api/v1/_platform/validate']).toBeDefined();
      const signUp = document.components.schemas['SignUpDto'];
      expect(Object.keys(signUp?.properties ?? {})).toEqual(['email', 'age']);
      expect(signUp?.required).toEqual(['email', 'age']);

      // Responses come from @ZodResponse: the schema the serializer enforces is the one documented.
      expect(document.openapi).toBe('3.1.0');
      expect(document.paths['/api/v1/posts']?.get?.responses['200']).toEqual({
        description: '',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/PostListDto_Output' } },
        },
      });
      expect(
        Object.keys(document.components.schemas['PostDto_Output']?.properties ?? {}),
      ).toContain('likedByMe');
      expect(Object.keys(document.paths['/api/v1/posts']?.post?.responses ?? {})).toEqual(['201']);
      expect(Object.keys(document.paths['/api/v1/posts/{id}/like']?.put?.responses ?? {})).toEqual([
        '204',
      ]);
    });
  });
});
