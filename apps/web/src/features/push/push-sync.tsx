import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCurrentUser } from '@/features/auth/current-user';
import { savePushSubscription } from '@/lib/api/push';
import {
  currentSubscription,
  pushOwner,
  pushSupported,
  resubscribe,
  serviceWorker,
  setPushActiveHere,
  setPushOwner,
  subscribedWith,
  subscriptionInput,
} from '@/lib/push';
import { usePushPublicKey } from './use-push';

/**
 * Keeps this browser's push subscription and the API in step for the signed-in member (ADR
 * 0022), on every start of a signed-in tab: the subscription goes to the API again (a sign-in
 * that ended took it off there; signing in again here brings it back), and one left by another
 * member is dropped, and one made with keys the server no longer has is made again. Also
 * routes a clicked notification inside the open tab.
 */
export default function PushSync() {
  const me = useCurrentUser();
  const publicKey = usePushPublicKey();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pushSupported() || !publicKey) return undefined;
    let cancelled = false;
    void (async () => {
      await serviceWorker();
      if (Notification.permission !== 'granted') return;
      const existing = await currentSubscription();
      if (!existing || cancelled) return;
      if (pushOwner() !== me.id) {
        await existing.unsubscribe();
        setPushOwner(null);
        return;
      }
      // The server's keys were replaced: the old subscription would only collect refusals.
      const subscription = subscribedWith(existing, publicKey)
        ? existing
        : await resubscribe(existing, publicKey);
      if (!subscription) return;
      const input = subscriptionInput(subscription);
      if (!input) return;
      try {
        await savePushSubscription(input);
        if (!cancelled) setPushActiveHere(true);
      } catch {
        // Offline or the server said no: the next start tries again.
      }
    })();
    return () => {
      cancelled = true;
      setPushActiveHere(false);
    };
  }, [publicKey, me.id]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
    const onMessage = (event: MessageEvent<unknown>) => {
      const data: unknown = event.data;
      if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === 'beso:navigate' &&
        'url' in data &&
        typeof data.url === 'string' &&
        data.url.startsWith('/')
      ) {
        void navigate(data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  return null;
}
