import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import { isRecord } from '../common/type-guards.js';

export const CREDENTIAL_ROUTE_KEY = 'credentialRoute';

/** Marks login/register so the two credential throttlers below apply to them (and only them). */
export const CredentialRoute = (): MethodDecorator => SetMetadata(CREDENTIAL_ROUTE_KEY, true);

export function isCredentialRoute(context: ExecutionContext): boolean {
  return Reflect.getMetadata(CREDENTIAL_ROUTE_KEY, context.getHandler()) === true;
}

export const CREDENTIAL_THROTTLE = {
  /** Attempts against one account from one address. */
  perAccount: { limit: 10, ttl: 60_000 },
  /** Attempts from one address regardless of account: caps stuffing/spraying and argon2 CPU. */
  perAddress: { limit: 30, ttl: 60_000 },
} as const;

/** `${ip}:${email}` – the body is read before validation, so normalise defensively. */
export function accountTracker(req: Record<string, unknown>): string {
  const body = isRecord(req.body) ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const ip = typeof req.ip === 'string' ? req.ip : '';
  return `${ip}:${email}`;
}

const notCredentialRoute = (context: ExecutionContext): boolean => !isCredentialRoute(context);

/** Registered next to the global throttler; both stack with it on credential routes. */
export const CREDENTIAL_THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'credentialsAccount',
    ...CREDENTIAL_THROTTLE.perAccount,
    getTracker: accountTracker,
    skipIf: notCredentialRoute,
  },
  { name: 'credentialsAddress', ...CREDENTIAL_THROTTLE.perAddress, skipIf: notCredentialRoute },
];
