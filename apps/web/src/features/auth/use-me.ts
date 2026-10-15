import { type QueryClient, useQuery } from '@tanstack/react-query';
import type { MeResponse, UserPrivate } from '@the-mesh/shared';
import { fetchMe } from '@/lib/api/auth';
import { queryKeys } from '@/lib/query-keys';

export const meQueryOptions = {
  queryKey: queryKeys.me,
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchMe(signal),
  staleTime: 5 * 60 * 1000,
  retry: false,
} as const;

export type MeState =
  | { status: 'loading'; user: undefined }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: UserPrivate };

/** The current session. `loading` only until the first /auth/me answer arrives. */
export function useMe(): MeState {
  const { data, isPending } = useQuery(meQueryOptions);
  if (isPending) return { status: 'loading', user: undefined };
  if (!data) return { status: 'anonymous', user: null };
  return { status: 'authenticated', user: data.user };
}

/** Updates the cached viewer (after a profile edit, for example). */
export function setMe(queryClient: QueryClient, me: MeResponse | null): void {
  queryClient.setQueryData(queryKeys.me, me);
}

/** Everything cached except the session itself belongs to one viewer and must not outlive them. */
function dropSessionData(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
}

export function startSession(queryClient: QueryClient, me: MeResponse): void {
  dropSessionData(queryClient);
  setMe(queryClient, me);
}

export function endSession(queryClient: QueryClient): void {
  setMe(queryClient, null);
  dropSessionData(queryClient);
}
