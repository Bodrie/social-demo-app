import {
  type ChangePasswordInput,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
  meResponseSchema,
} from '@the-mesh/shared';
import { api, isApiClientError } from './client';

/** null when there is no session (401), so callers never treat "logged out" as an error. */
export async function fetchMe(signal?: AbortSignal): Promise<MeResponse | null> {
  try {
    return await api.get('/auth/me', meResponseSchema, { signal });
  } catch (error) {
    if (isApiClientError(error) && error.status === 401) return null;
    throw error;
  }
}

export const login = (input: LoginInput) =>
  api.post('/auth/login', input, { schema: meResponseSchema, retryOnUnauthorized: false });

export const register = (input: RegisterInput) =>
  api.post('/auth/register', input, { schema: meResponseSchema, retryOnUnauthorized: false });

export const logout = () => api.post('/auth/logout', undefined, { retryOnUnauthorized: false });

export const changePassword = (input: ChangePasswordInput): Promise<void> =>
  api.post('/auth/password', input);

/** Ends every session, this one included. */
export const logoutEverywhere = (): Promise<void> =>
  api.post('/auth/logout-all', undefined, { retryOnUnauthorized: false });
