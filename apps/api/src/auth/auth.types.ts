import { type UserRole, userRoleSchema } from '@the-mesh/shared';
import type { Request } from 'express';
import { z } from 'zod';

/** What the auth guard attaches to the request. */
export type AuthUser = { id: string; emailVerified: boolean; role: UserRole };

export type AuthenticatedRequest = Request & { user?: AuthUser };

/**
 * Claims we sign; `exp`/`iat`/`iss` are added by the JWT library. `ev`: email verified;
 * `role`: so the roles guard needs no lookup (a demotion takes effect within the token's life).
 */
export type AccessTokenClaims = { sub: string; ev: boolean; role: UserRole };

/** What a verified token must contain before it is trusted. */
export const accessTokenPayloadSchema = z.object({
  sub: z.uuid(),
  /** Absent on tokens signed before verification existed; those accounts were verified by migration. */
  ev: z.boolean().optional(),
  /** Absent on tokens signed before roles existed: a member. */
  role: userRoleSchema.optional(),
  exp: z.number().int().optional(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

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
