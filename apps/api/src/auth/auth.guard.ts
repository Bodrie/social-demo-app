import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types.js';
import { ACCESS_COOKIE, readCookie } from './cookies.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/** Global guard: every route requires a valid access token unless marked @Public(). */
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
    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid or expired session' });
    }
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
