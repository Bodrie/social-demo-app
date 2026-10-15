import { type ApiError, type UserPrivate, loginSchema, registerSchema } from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { TEST_PASSWORD, makeUser } from '../fixtures';

/** Mutable per-test state for the mocked backend. Reset by `resetMockSession()` in setup. */
export const mockSession = {
  /** The signed-in user, or null for no session. */
  user: null as UserPrivate | null,
  /** Whether POST /auth/refresh succeeds. */
  refreshable: false,
  /** How many times each endpoint was hit. */
  calls: { me: 0, refresh: 0, login: 0, logout: 0 },
};

export function resetMockSession(): void {
  mockSession.user = null;
  mockSession.refreshable = false;
  mockSession.calls = { me: 0, refresh: 0, login: 0, logout: 0 };
}

export function signedInAs(user: UserPrivate = makeUser()): UserPrivate {
  mockSession.user = user;
  return user;
}

export const apiError = (
  statusCode: number,
  code: ApiError['code'],
  message: string,
  fields?: Record<string, string>,
) => HttpResponse.json<ApiError>({ statusCode, code, message, fields }, { status: statusCode });

export const unauthorized = () => apiError(401, 'UNAUTHORIZED', 'Authentication required');

const API = '*/api/v1';

export const handlers = [
  http.get(`${API}/auth/me`, () => {
    mockSession.calls.me += 1;
    return mockSession.user ? HttpResponse.json({ user: mockSession.user }) : unauthorized();
  }),

  http.post(`${API}/auth/refresh`, () => {
    mockSession.calls.refresh += 1;
    if (!mockSession.refreshable) return unauthorized();
    mockSession.user ??= makeUser();
    return HttpResponse.json({ user: mockSession.user });
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    mockSession.calls.login += 1;
    const body = loginSchema.parse(await request.json());
    if (body.password !== TEST_PASSWORD)
      return apiError(401, 'UNAUTHORIZED', 'Invalid email or password');
    mockSession.user = makeUser({ email: body.email });
    return HttpResponse.json({ user: mockSession.user });
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = registerSchema.parse(await request.json());
    if (body.username === 'taken') {
      return apiError(409, 'CONFLICT', 'Already in use', { username: 'This username is taken' });
    }
    mockSession.user = makeUser({ email: body.email, username: body.username, name: body.name });
    return HttpResponse.json({ user: mockSession.user }, { status: 201 });
  }),

  http.post(`${API}/auth/logout`, () => {
    mockSession.calls.logout += 1;
    mockSession.user = null;
    return new HttpResponse(null, { status: 204 });
  }),
];
