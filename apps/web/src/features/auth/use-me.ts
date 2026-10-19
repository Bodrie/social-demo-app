import {
  type QueryClient,
  type QueryFunctionContext,
  queryOptions,
  useQuery,
} from '@tanstack/react-query';
import type { MeResponse, UserPrivate } from '@the-mesh/shared';
import { refreshSession } from '@/lib/api/client';
import { fetchMe } from '@/lib/api/auth';
import { queryKeys } from '@/lib/query-keys';

/** How often the waiting room asks whether the address was confirmed on another device. */
export const UNVERIFIED_POLL_MS = 15_000;
const SESSION_CHANNEL = 'the-mesh:session';

/**
 * Every tab shares the cookies, so another tab (or device) may have changed who this one is
 * talking to. Compared with what was cached before: a different account means nothing cached
 * for the previous one may stay; a confirmation made elsewhere means this browser's access
 * token still says "unverified" until it is renewed.
 */
async function fetchViewer({ signal, client }: QueryFunctionContext): Promise<MeResponse | null> {
  const previous = client.getQueryData<MeResponse | null>(queryKeys.me);
  const next = await fetchMe(signal);
  if (previous && next && previous.user.id !== next.user.id) dropSessionData(client);
  if (
    previous?.user.id === next?.user.id &&
    previous?.user.emailVerifiedAt === null &&
    next?.user.emailVerifiedAt
  ) {
    await refreshSession();
  }
  return next;
}

export const meQueryOptions = queryOptions({
  queryKey: queryKeys.me,
  queryFn: fetchViewer,
  staleTime: 5 * 60 * 1000,
  retry: false,
  // Looking at the tab again checks who it is signed in as (see fetchViewer).
  refetchOnWindowFocus: 'always',
  refetchInterval: (query) =>
    query.state.data?.user.emailVerifiedAt === null ? UNVERIFIED_POLL_MS : false,
});

export type MeState =
  | { status: 'loading'; user: undefined }
  | { status: 'anonymous'; user: null }
  /** /auth/me failed for a reason other than "no session" (the API is down, a 5xx, no network). */
  | { status: 'error'; user: undefined; retry: () => void }
  | { status: 'authenticated'; user: UserPrivate };

/**
 * The current session. `loading` only until the first /auth/me answer arrives; a request that
 * fails for any reason but 401 is `error`, never "anonymous" (review L8): valid cookies must
 * not land on the sign-in page because the API was restarting.
 */
export function useMe(): MeState {
  const { data, isPending, isError, refetch } = useQuery(meQueryOptions);
  if (isPending) return { status: 'loading', user: undefined };
  if (isError) return { status: 'error', user: undefined, retry: () => void refetch() };
  if (!data) return { status: 'anonymous', user: null };
  return { status: 'authenticated', user: data.user };
}

/** Replaces the cached viewer (after a profile edit, for example). */
export function setMe(queryClient: QueryClient, me: MeResponse | null): void {
  queryClient.setQueryData(queryKeys.me, me);
}

/** Adjusts the cached viewer in place (counts, for example); no-op without a session. */
export function updateMe(
  queryClient: QueryClient,
  update: (user: UserPrivate) => UserPrivate,
): void {
  queryClient.setQueryData<MeResponse | null>(queryKeys.me, (me) =>
    me ? { user: update(me.user) } : me,
  );
}

/** Everything cached except the session itself belongs to one viewer and must not outlive them. */
function dropSessionData(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
}

let channel: BroadcastChannel | null = null;

/**
 * Tells the other tabs that this one signed in or out on purpose, so they check at once
 * instead of acting as the previous account until they are looked at again. Never called
 * for a session that was merely found to be over: every tab finds that out by itself, and
 * announcing it would have the tabs set each other off.
 */
export function announceSessionChange(): void {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a BroadcastChannel has no target origin
  channel?.postMessage('changed');
}

/** Listens for the other tabs' announcements (mounted once, by the app providers). */
export function watchOtherTabs(queryClient: QueryClient): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const own = new BroadcastChannel(SESSION_CHANNEL);
  channel = own;
  own.addEventListener('message', () => {
    // Announcements are deliberate sign-ins and sign-outs; if this one turns out to be a
    // sign-out, the redirect to /login must not keep the page for the next person.
    deliberateSignOutAt = Date.now();
    void queryClient.refetchQueries({ queryKey: queryKeys.me });
  });
  return () => {
    own.close();
    if (channel === own) channel = null;
  };
}

export function startSession(queryClient: QueryClient, me: MeResponse): void {
  dropSessionData(queryClient);
  setMe(queryClient, me);
  announceSessionChange();
}

/** When the viewer (or another tab) signed out on purpose, within the last few seconds. */
let deliberateSignOutAt = 0;
const DELIBERATE_SIGN_OUT_WINDOW_MS = 5_000;

export function signedOutDeliberately(): boolean {
  return Date.now() - deliberateSignOutAt < DELIBERATE_SIGN_OUT_WINDOW_MS;
}

/**
 * Drops the session. `deliberate` marks a sign-out the person asked for (as opposed to a
 * session that was found to be lost), so the guard does not send the next person who signs
 * in on this browser to the previous one's page (review L7).
 */
export function endSession(queryClient: QueryClient, options: { deliberate?: boolean } = {}): void {
  if (options.deliberate) deliberateSignOutAt = Date.now();
  setMe(queryClient, null);
  dropSessionData(queryClient);
}
