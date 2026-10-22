import { queryOptions, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/features/auth/current-user';
import { fetchPushConfig, removePushSubscription, savePushSubscription } from '@/lib/api/push';
import {
  PushPermissionError,
  currentSubscription,
  needsHomeScreen,
  pushOwner,
  pushSupported,
  setPushActiveHere,
  setPushOwner,
  subscribeThisBrowser,
  subscriptionInput,
  unsubscribeThisBrowser,
} from '@/lib/push';
import { queryKeys } from '@/lib/query-keys';

export const pushConfigQueryOptions = queryOptions({
  queryKey: queryKeys.push.config,
  queryFn: ({ signal }) => fetchPushConfig(signal),
  staleTime: Number.POSITIVE_INFINITY,
});

/** Whether the server has push switched on (null while asking). */
export function usePushPublicKey(): string | null | undefined {
  return useQuery(pushConfigQueryOptions).data?.publicKey;
}

/**
 * What this device can do about push: `unsupported` (no push in this browser), `install` (an
 * iPhone or iPad before BeSo is on its Home Screen), `unavailable` (the server has push off),
 * `blocked` (notifications denied for the site), or `off` / `on` for this member.
 */
export type PushState =
  'checking' | 'unsupported' | 'install' | 'unavailable' | 'blocked' | 'off' | 'on';

export function usePushDevice() {
  const me = useCurrentUser();
  const publicKey = usePushPublicKey();
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let next: PushState;
      if (!pushSupported()) next = needsHomeScreen() ? 'install' : 'unsupported';
      else if (publicKey === undefined) next = 'checking';
      else if (publicKey === null) next = 'unavailable';
      else if (Notification.permission === 'denied') next = 'blocked';
      else {
        const subscription = await currentSubscription();
        next = subscription && pushOwner() === me.id ? 'on' : 'off';
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, me.id]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const input = subscriptionInput(await subscribeThisBrowser(publicKey));
      if (!input) throw new Error('This browser’s push service is not one BeSo can reach');
      await savePushSubscription(input);
      setPushOwner(me.id);
      setPushActiveHere(true);
      setState('on');
    } catch (error) {
      if (error instanceof PushPermissionError) setState('blocked');
      toast.error(error instanceof Error ? error.message : 'Could not switch push on');
    } finally {
      setBusy(false);
    }
  }, [publicKey, me.id]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const endpoint = await unsubscribeThisBrowser();
      setPushOwner(null);
      setPushActiveHere(false);
      setState('off');
      // The browser no longer has it either way; the API forgets it now rather than at the
      // next push its service refuses.
      if (endpoint) await removePushSubscription(endpoint).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
