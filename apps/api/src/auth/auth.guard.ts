import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { emailNotVerified, unauthorized } from '../common/errors.js';
import { AccessTokensService } from '../tokens/access-tokens.service.js';
import { ALLOW_UNVERIFIED_KEY } from './allow-unverified.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { ACCESS_COOKIE, readCookie } from './cookies.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Global guard: every HTTP route requires a valid access token unless marked @Public(), and
 * a token for an unverified address only opens routes marked @AllowUnverified().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: AccessTokensService,
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

    const payload = await this.tokens.verify(token);
    if (!payload) throw unauthorized('Invalid or expired session');
    const emailVerified = payload.ev ?? true;
    request.user = {
      id: payload.sub,
      emailVerified,
      role: payload.role ?? 'member',
      signInId: payload.sid ?? null,
    };

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
