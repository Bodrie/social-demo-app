import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type UserRole, userRoleSchema } from '@beso/shared';
import { z } from 'zod';

/**
 * Claims we sign; `exp`/`iat`/`iss` are added by the JWT library. `ev`: email verified;
 * `role`: so the roles guard needs no lookup (a demotion takes effect within the token's life);
 * `sid`: the sign-in the session descends from (ADR 0022), stable across refresh rotations.
 */
export type AccessTokenClaims = { sub: string; ev: boolean; role: UserRole; sid: string };

/** What a verified token must contain before it is trusted. */
export const accessTokenPayloadSchema = z.object({
  sub: z.uuid(),
  /** Absent on tokens signed before verification existed; those accounts were verified by migration. */
  ev: z.boolean().optional(),
  /** Absent on tokens signed before roles existed: a member. */
  role: userRoleSchema.optional(),
  /** Absent on tokens signed before sign-ins had ids (they are refreshed within 15 minutes). */
  sid: z.uuid().optional(),
  exp: z.number().int().optional(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

/**
 * The short-lived access token: signed at sign-in and refresh (AuthService), checked by the
 * global AuthGuard and at the socket handshake. The only holder of the JWT secret.
 */
@Injectable()
export class AccessTokensService {
  constructor(private readonly jwt: JwtService) {}

  sign(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims);
  }

  /** Verifies signature, issuer and expiry, then the claim shape; undefined when any of it fails. */
  async verify(token: string): Promise<AccessTokenPayload | undefined> {
    try {
      const parsed = accessTokenPayloadSchema.safeParse(await this.jwt.verifyAsync<object>(token));
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }
}
