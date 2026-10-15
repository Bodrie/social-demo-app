import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { CurrentUserContext } from '@/features/auth/current-user';
import { redirectTarget } from '@/features/auth/redirect-target';
import { useMe } from '@/features/auth/use-me';

/** Layout route: renders children only with a session; otherwise sends to /login and remembers where to return. */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.status === 'loading') return <FullPageSpinner label="Checking your session" />;
  if (me.status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  return (
    <CurrentUserContext value={me.user}>
      <Outlet />
    </CurrentUserContext>
  );
}

/**
 * The opposite: signed-in users have no business on /login or /register. This is also
 * what moves a freshly signed-in viewer on (to where RequireAuth sent them from, if
 * anywhere), so the auth pages never have to navigate themselves.
 */
export function RedirectIfAuthenticated() {
  const me = useMe();
  const location = useLocation();
  if (me.status === 'loading') return <FullPageSpinner label="Checking your session" />;
  if (me.status === 'authenticated')
    return <Navigate to={redirectTarget(location.state)} replace />;
  return <Outlet />;
}
