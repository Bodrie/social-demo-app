import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ApiError,
  verifyEmailSchema,
} from '@the-mesh/shared';
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
        emailVerifiedAt: null,
      }),
    );
    mockDb.emailTokens.push({
      token: `verify-${mockDb.user.id}`,
      kind: 'verify',
      email: body.email,
    });
    return HttpResponse.json({ user: mockDb.user }, { status: 201 });
  }),

  http.post(`${API}/auth/verify-email`, async ({ request }) => {
    const body = verifyEmailSchema.parse(await request.json());
    const entry = mockDb.emailTokens.find((e) => e.kind === 'verify' && e.token === body.token);
    const user = entry && mockDb.users.find((u) => u.email === entry.email);
    if (!entry || !user) {
      return apiError(400, 'BAD_REQUEST', 'This link is invalid, has expired or was already used', {
        token: 'This link is invalid, has expired or was already used',
      });
    }
    mockDb.emailTokens = mockDb.emailTokens.filter((e) => e !== entry);
    user.emailVerifiedAt = new Date().toISOString();
    mockDb.user = user;
    return HttpResponse.json({ user });
  }),

  http.post(`${API}/auth/verify-email/resend`, () => {
    if (!mockDb.user) return unauthorized();
    const sent = mockDb.emailTokens.filter((e) => e.email === mockDb.user?.email).length;
    if (sent >= 3) return apiError(429, 'TOO_MANY_REQUESTS', 'Too many requests');
    mockDb.emailTokens.push({
      token: `verify-again-${sent}`,
      kind: 'verify',
      email: mockDb.user.email,
    });
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/auth/forgot-password`, async ({ request }) => {
    const body = forgotPasswordSchema.parse(await request.json());
    mockDb.calls.forgot += 1;
    if (mockDb.users.some((u) => u.email === body.email)) {
      mockDb.emailTokens.push({ token: `reset-${body.email}`, kind: 'reset', email: body.email });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/auth/reset-password`, async ({ request }) => {
    const parsed = resetPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(400, 'VALIDATION_ERROR', 'Validation failed', { newPassword: 'Too short' });
    }
    const entry = mockDb.emailTokens.find(
      (e) => e.kind === 'reset' && e.token === parsed.data.token,
    );
    const user = entry && mockDb.users.find((u) => u.email === entry.email);
    if (!entry || !user) {
      return apiError(400, 'BAD_REQUEST', 'This link is invalid, has expired or was already used', {
        token: 'This link is invalid, has expired or was already used',
      });
    }
    mockDb.emailTokens = mockDb.emailTokens.filter((e) => e !== entry);
    user.emailVerifiedAt ??= new Date().toISOString();
    mockDb.user = user;
    return HttpResponse.json({ user });
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
