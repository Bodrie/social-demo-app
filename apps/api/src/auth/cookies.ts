import type { Response } from 'express';
import { API_PREFIX } from '../common/constants.js';
import { isRecord } from '../common/type-guards.js';
import type { IssuedTokens } from './auth.types.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
/** The refresh token is only ever sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;

export type CookieSettings = {
  secure: boolean;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
};

const base = (secure: boolean) => ({ httpOnly: true, secure, sameSite: 'lax' as const });

export function setAuthCookies(res: Response, tokens: IssuedTokens, settings: CookieSettings): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(settings.secure),
    path: '/',
    maxAge: settings.accessMaxAgeMs,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(settings.secure),
    path: REFRESH_COOKIE_PATH,
    maxAge: settings.refreshMaxAgeMs,
  });
}

export function clearAuthCookies(res: Response, settings: CookieSettings): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(settings.secure), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(settings.secure), path: REFRESH_COOKIE_PATH });
}

export function readCookie(cookies: unknown, name: string): string | undefined {
  if (!isRecord(cookies)) return undefined;
  const value = cookies[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
