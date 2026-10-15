import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { ACCESS_COOKIE } from '../auth/cookies.js';
import { isRecord } from '../common/guards.js';

/** Minimal cookie header parser (values are URL-decoded like express does). */
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
}

/** The access token from the handshake: cookie (browsers) or `auth.token` (other clients). */
export function handshakeToken(socket: Socket): string | undefined {
  const fromCookie = parseCookies(socket.handshake.headers.cookie)[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;
  const auth: unknown = socket.handshake.auth;
  if (isRecord(auth) && typeof auth.token === 'string' && auth.token.length > 0) return auth.token;
  return undefined;
}

/** Resolves the user id for a connecting socket, or undefined when it must be refused. */
export async function authenticateSocket(socket: Socket, jwt: JwtService): Promise<string | undefined> {
  const token = handshakeToken(socket);
  if (!token) return undefined;
  try {
    const payload = await jwt.verifyAsync<AccessTokenPayload>(token);
    return payload.sub;
  } catch {
    return undefined;
  }
}
