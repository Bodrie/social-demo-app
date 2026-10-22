import { Navigate } from 'react-router';
import { useCurrentUser } from '@/features/auth/current-user';

/** `/badges` (where a badge notification leads): the member's own Badges tab. */
export function BadgesRedirect() {
  const me = useCurrentUser();
  return <Navigate to={`/u/${me.username}/badges`} replace />;
}
