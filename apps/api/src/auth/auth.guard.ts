import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { emailNotVerified, unauthorized } from '../common/errors.js';
import { ALLOW_UNVERIFIED_KEY } from './allow-unverified.decorator.js';
import { type AuthenticatedRequest, accessTokenPayloadSchema } from './auth.types.js';
import { ACCESS_COOKIE, readCookie } from './cookies.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Global guard: every HTTP route requires a valid access token unless marked @Public(), and
 * a token for an unverified address only opens routes marked @AllowUnverified().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket clients are authenticated once, at handshake (see ChatGateway).
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractAccessToken(request);
    if (!token) throw unauthorized('Authentication required');

    const payload = await verifyAccessToken(this.jwt, token);
    if (!payload) throw unauthorized('Invalid or expired session');
    const emailVerified = payload.ev ?? true;
    request.user = { id: payload.sub, emailVerified };

    if (!emailVerified) {
      const allowed = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_UNVERIFIED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) throw emailNotVerified();
    }
    return true;
  }
}

/** Verifies signature, issuer and expiry, then the claim shape; undefined when any of it fails. */
export async function verifyAccessToken(jwt: JwtService, token: string) {
  try {
    const parsed = accessTokenPayloadSchema.safeParse(await jwt.verifyAsync<object>(token));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Cookie first (browser), then Authorization: Bearer (API clients, Swagger "try it out"). */
export function extractAccessToken(request: AuthenticatedRequest): string | undefined {
  const fromCookie = readCookie(request.cookies, ACCESS_COOKIE);
  if (fromCookie) return fromCookie;
  const header = request.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : undefined;
  }
  return undefined;
}
