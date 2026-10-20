import type { UserPrivate } from '@beso/shared';
import { createContext, useContext } from 'react';

/**
 * Provided by the RequireAuth route. Children read the user from here rather than
 * from the query cache so they can never observe a newer session state than the
 * guard that rendered them (which would throw mid-render while signing out).
 */
export const CurrentUserContext = createContext<UserPrivate | null>(null);

/** The signed-in user; only for components rendered inside a protected route. */
export function useCurrentUser(): UserPrivate {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser() used outside a protected route');
  return user;
}
