import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { unauthorized } from '../common/errors.js';
import type { AuthUser, AuthenticatedRequest } from './auth.types.js';

/** The authenticated user ({ id }). Throws if used on a route the guard did not protect. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) throw unauthorized('Authentication required');
  return request.user;
});
