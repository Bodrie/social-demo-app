import type { ApiError } from '@beso/shared';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const normalise = (origin: string): string => origin.trim().replace(/\/+$/, '').toLowerCase();

/**
 * Whether a browser origin may talk to us: one of the configured web origins, or the API's
 * own host (Swagger UI in development, the single origin behind Caddy in production). A
 * request without an Origin header did not come from a browser page and is allowed; the
 * literal "null" origin (sandboxed frames, some redirects) is not.
 */
export function originAllowed(
  origin: string | undefined,
  allowed: readonly string[],
  host: string | undefined,
): boolean {
  if (origin === undefined) return true;
  const candidate = normalise(origin);
  if (allowed.some((entry) => normalise(entry) === candidate)) return true;
  if (!host) return false;
  const self = host.trim().toLowerCase();
  return candidate === `http://${self}` || candidate === `https://${self}`;
}

/**
 * CSRF guard for the cookie session: browsers always send `Origin` on cross-origin requests
 * and on every POST/PUT/PATCH/DELETE, so a state-changing request from a page we did not
 * serve is refused before any handler (or body parser side effect) runs. Safe methods pass
 * untouched; SameSite=Lax cookies cover what this cannot see.
 */
export function originCheck(allowed: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (
      SAFE_METHODS.has(req.method) ||
      originAllowed(req.get('origin'), allowed, req.get('host'))
    ) {
      next();
      return;
    }
    const body: ApiError = {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Cross-origin request refused',
    };
    res.status(403).json(body);
  };
}
