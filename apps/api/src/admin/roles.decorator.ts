import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@beso/shared';

export const ROLES_KEY = 'roles';

/** Handlers or controllers only members with one of these roles may call (`RolesGuard`). */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
