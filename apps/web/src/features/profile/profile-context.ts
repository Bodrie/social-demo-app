import type { UserPublic } from '@beso/shared';
import { useOutletContext } from 'react-router';

export type ProfileContext = { user: UserPublic };

/** The profile a nested tab route (posts, followers, following) is showing. */
export function useProfileContext(): ProfileContext {
  return useOutletContext<ProfileContext>();
}
