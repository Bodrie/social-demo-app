import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/**
 * The app is closed until the email address is confirmed: the AuthGuard answers 403 to a
 * session whose token says "unverified", except on routes marked with this (reading the own
 * profile, asking for the mail again, signing out everywhere).
 */
export const AllowUnverified = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_UNVERIFIED_KEY, true);
