import type { UserRole } from '@beso/shared';
import type { Request } from 'express';

/** What the auth guard attaches to the request. */
export type AuthUser = { id: string; emailVerified: boolean; role: UserRole };

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Client details recorded with each refresh token. */
export type RequestMeta = { userAgent?: string; ip?: string };

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export function requestMeta(req: Request): RequestMeta {
  const userAgent = req.headers['user-agent'];
  return {
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : undefined,
    ip: req.ip,
  };
}
