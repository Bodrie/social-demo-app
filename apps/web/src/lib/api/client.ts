import { type ApiError, apiErrorSchema } from '@the-mesh/shared';
import type { z } from 'zod';
import { API_URL } from '../env';

/** Thrown for any non-2xx response; `error` is the API's envelope (or a synthesised one). */
export class ApiClientError extends Error {
  readonly error: ApiError;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.error = error;
  }

  get status(): number {
    return this.error.statusCode;
  }

  get fields(): Record<string, string> {
    return this.error.fields ?? {};
  }
}

export function isApiClientError(value: unknown): value is ApiClientError {
  return value instanceof ApiClientError;
}

type RequestOptions<T> = {
  body?: unknown;
  /** Validates and types the response; omit for 204/empty responses. */
  schema?: z.ZodType<T>;
  /** FormData is sent as multipart; everything else as JSON. */
  formData?: FormData;
  signal?: AbortSignal;
  /** Set false for the auth endpoints themselves so a 401 does not trigger a refresh loop. */
  retryOnUnauthorized?: boolean;
};

type Listener = () => void;
const sessionLostListeners = new Set<Listener>();

/** Called once when a refresh fails: the session is over and the UI should show the login page. */
export function onSessionLost(listener: Listener): () => void {
  sessionLostListeners.add(listener);
  return () => sessionLostListeners.delete(listener);
}

/** For other transports (the chat socket) that learn about a dead session on their own. */
export function notifySessionLost(): void {
  for (const listener of sessionLostListeners) listener();
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Refreshes the session at most once at a time per tab (single flight) and, where
 * the Web Locks API exists, at most once at a time per browser: the refresh token
 * is single-use, so two tabs refreshing together would otherwise log everyone out.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= runExclusive('the-mesh:refresh', async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function runExclusive<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return task();
  return locks.request(name, task);
}

async function toApiError(response: Response): Promise<ApiError> {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => undefined));
  if (parsed.success) return parsed.data;
  return {
    statusCode: response.status,
    code:
      response.status === 401
        ? 'UNAUTHORIZED'
        : response.status >= 500
          ? 'INTERNAL_ERROR'
          : 'BAD_REQUEST',
    message: response.statusText || 'Request failed',
  };
}

async function send<T>(
  method: string,
  path: string,
  options: RequestOptions<T>,
  attempt = 0,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body,
    credentials: 'include',
    signal: options.signal,
  });

  if (response.status === 401 && options.retryOnUnauthorized !== false && attempt === 0) {
    if (await refreshSession()) return send(method, path, options, attempt + 1);
    notifySessionLost();
  }

  if (!response.ok) throw new ApiClientError(await toApiError(response));
  // Without a schema the caller asked for nothing back (T is void).
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  if (response.status === 204 || !options.schema) return undefined as T;
  return options.schema.parse(await response.json());
}

export const api = {
  get: <T>(
    path: string,
    schema: z.ZodType<T>,
    options: Omit<RequestOptions<T>, 'schema' | 'body'> = {},
  ) => send<T>('GET', path, { ...options, schema }),
  post: <T = void>(path: string, body?: unknown, options: Omit<RequestOptions<T>, 'body'> = {}) =>
    send<T>('POST', path, { ...options, body }),
  put: <T = void>(path: string, body?: unknown, options: Omit<RequestOptions<T>, 'body'> = {}) =>
    send<T>('PUT', path, { ...options, body }),
  patch: <T = void>(path: string, body?: unknown, options: Omit<RequestOptions<T>, 'body'> = {}) =>
    send<T>('PATCH', path, { ...options, body }),
  /** A body is allowed: `DELETE /users/me` carries the confirming password. */
  delete: <T = void>(path: string, options: RequestOptions<T> = {}) =>
    send<T>('DELETE', path, options),
};
