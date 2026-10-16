import { type ApiError, changePasswordSchema, loginSchema, registerSchema } from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { TEST_PASSWORD, makeUser, testId } from '../fixtures';
import { mockDb, upsertUser } from './db';

export const apiError = (
  statusCode: number,
  code: ApiError['code'],
  message: string,
  fields?: Record<string, string>,
) => HttpResponse.json<ApiError>({ statusCode, code, message, fields }, { status: statusCode });

export const unauthorized = () => apiError(401, 'UNAUTHORIZED', 'Authentication required');

export const API = '*/api/v1';

export const authHandlers = [
  http.get(`${API}/auth/me`, () => {
    mockDb.calls.me += 1;
    return mockDb.user ? HttpResponse.json({ user: mockDb.user }) : unauthorized();
  }),

  http.post(`${API}/auth/refresh`, () => {
    mockDb.calls.refresh += 1;
    if (!mockDb.refreshable) return unauthorized();
    mockDb.user ??= upsertUser(makeUser());
    return HttpResponse.json({ user: mockDb.user });
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    mockDb.calls.login += 1;
    const body = loginSchema.parse(await request.json());
    if (body.password !== TEST_PASSWORD) {
      return apiError(401, 'UNAUTHORIZED', 'Invalid email or password');
    }
    mockDb.user = upsertUser(makeUser({ email: body.email }));
    return HttpResponse.json({ user: mockDb.user });
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = registerSchema.parse(await request.json());
    if (body.username === 'taken') {
      return apiError(409, 'CONFLICT', 'Already in use', { username: 'This username is taken' });
    }
    mockDb.user = upsertUser(
      makeUser({
        id: testId('user', mockDb.users.length + 1),
        email: body.email,
        username: body.username,
        name: body.name,
      }),
    );
    return HttpResponse.json({ user: mockDb.user }, { status: 201 });
  }),

  http.post(`${API}/auth/password`, async ({ request }) => {
    if (!mockDb.user) return unauthorized();
    const parsed = changePasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', { newPassword: 'Invalid' });
    }
    if (parsed.data.currentPassword !== TEST_PASSWORD) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', {
        currentPassword: 'Wrong password',
      });
    }
    mockDb.calls.passwordChanges += 1;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/auth/logout-all`, () => {
    mockDb.calls.logout += 1;
    mockDb.user = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/auth/logout`, () => {
    mockDb.calls.logout += 1;
    mockDb.user = null;
    return new HttpResponse(null, { status: 204 });
  }),
];
