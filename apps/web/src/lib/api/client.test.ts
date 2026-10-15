import { HttpResponse, http } from 'msw/http';
import { z } from 'zod';
import { mockDb, unauthorized } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { ApiClientError, api, isApiClientError, onSessionLost } from './client';

/** Awaits a rejection and returns it typed, so assertions need no casts. */
async function rejection(promise: Promise<unknown>): Promise<ApiClientError> {
  try {
    await promise;
  } catch (error) {
    if (isApiClientError(error)) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
}

const pingSchema = z.object({ ok: z.boolean() });
let pingCalls = 0;

beforeEach(() => {
  pingCalls = 0;
  server.use(
    http.get('*/api/v1/ping', () => {
      pingCalls += 1;
      return pingCalls === 1 && mockDb.refreshable ? unauthorized() : HttpResponse.json({ ok: true });
    }),
  );
});

describe('api client', () => {
  it('parses successful responses with the given schema', async () => {
    await expect(api.get('/ping', pingSchema)).resolves.toEqual({ ok: true });
  });

  it('refreshes once and retries when a request is unauthorized', async () => {
    mockDb.refreshable = true;
    await expect(api.get('/ping', pingSchema)).resolves.toEqual({ ok: true });
    expect(mockDb.calls.refresh).toBe(1);
    expect(pingCalls).toBe(2);
  });

  it('shares one refresh between concurrent unauthorized requests', async () => {
    mockDb.refreshable = true;
    server.use(http.get('*/api/v1/ping', () => (mockDb.calls.refresh === 0 ? unauthorized() : HttpResponse.json({ ok: true }))));
    await Promise.all([api.get('/ping', pingSchema), api.get('/ping', pingSchema), api.get('/ping', pingSchema)]);
    expect(mockDb.calls.refresh).toBe(1);
  });

  it('reports a lost session when the refresh fails and surfaces the envelope', async () => {
    const lost = vi.fn();
    const unsubscribe = onSessionLost(lost);
    server.use(http.get('*/api/v1/ping', () => unauthorized()));

    await expect(api.get('/ping', pingSchema)).rejects.toBeInstanceOf(ApiClientError);
    expect(mockDb.calls.refresh).toBe(1);
    expect(lost).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('exposes field errors from the envelope', async () => {
    server.use(
      http.post('*/api/v1/things', () =>
        HttpResponse.json({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', fields: { name: 'Required' } }, { status: 400 }),
      ),
    );
    const error = await rejection(api.post('/things', {}));
    expect(error.fields).toEqual({ name: 'Required' });
    expect(error.status).toBe(400);
  });

  it('synthesises an envelope when the body is not one', async () => {
    server.use(http.get('*/api/v1/ping', () => new HttpResponse('nope', { status: 502, statusText: 'Bad Gateway' })));
    const error = await rejection(api.get('/ping', pingSchema));
    expect(error.error).toMatchObject({ statusCode: 502, code: 'INTERNAL_ERROR' });
  });
});
