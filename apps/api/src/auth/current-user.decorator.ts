import { type ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { AuthUser, AuthenticatedRequest } from './auth.types.js';

/** The authenticated user ({ id }). Throws if used on a route the guard did not protect. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return request.user;
});
