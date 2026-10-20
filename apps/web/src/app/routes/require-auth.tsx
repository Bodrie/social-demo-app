import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { SessionError } from '@/components/session-error';
import { CurrentUserContext } from '@/features/auth/current-user';
import { ChatProvider } from '@/features/chat/chat-provider';
import { redirectTarget } from '@/features/auth/redirect-target';
import { signedOutDeliberately, useMe } from '@/features/auth/use-me';

/**
 * Layout route: renders children only with a verified session. Anonymous visitors go to
 * /login (and come back afterwards); members who have not confirmed their address yet are
 * held on /verify-email, the only page open to them.
 */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.status === 'loading') return <FullPageSpinner label="Checking your session" />;
  if (me.status === 'error') return <SessionError retry={me.retry} />;
  if (me.status === 'anonymous') {
    // After a deliberate sign-out the next sign-in starts at home, not on the last page.
    const from = signedOutDeliberately() ? undefined : `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={from ? { from } : undefined} />;
  }
  if (me.user.emailVerifiedAt === null) return <Navigate to="/verify-email" replace />;
  // Keyed by the account: when another tab signs in as someone else, everything below starts
  // over (fresh queries, a new socket) instead of mixing two people's data.
  return (
    <CurrentUserContext key={me.user.id} value={me.user}>
      <ChatProvider>
        <Outlet />
      </ChatProvider>
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
  if (me.status === 'error') return <SessionError retry={me.retry} />;
  if (me.status === 'authenticated') {
    const to = me.user.emailVerifiedAt === null ? '/verify-email' : redirectTarget(location.state);
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}
