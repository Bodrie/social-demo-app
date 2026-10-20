import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@the-mesh/shared';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { forbidden } from '../common/errors.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Runs after the `AuthGuard`, which put the token's `role` on the request: a route marked
 * `@Roles('admin')` answers 403 to everyone else. Routes without the mark are untouched.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user || !roles.includes(request.user.role)) throw forbidden('Admins only');
    return true;
  }
}
