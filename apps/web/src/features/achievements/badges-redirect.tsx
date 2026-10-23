import { Navigate, useLocation } from 'react-router';
import { useCurrentUser } from '@/features/auth/current-user';

/** `/badges` (where a badge notification leads): the member's own Badges tab, `?share=` kept. */
export function BadgesRedirect() {
  const me = useCurrentUser();
  const { search } = useLocation();
  return <Navigate to={`/u/${me.username}/badges${search}`} replace />;
}
