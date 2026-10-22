import { type PushSubscriptionInput, pushSubscriptionSchema } from '@beso/shared';

/**
 * Web push in this browser (ADR 0022): the service worker, the subscription, and which member
 * it belongs to. Nothing here talks to the API; `features/push` does.
 */

/** Whose subscription this browser holds: another member signing in here never inherits it. */
const OWNER_KEY = 'beso.push.owner';

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export function isStandalone(): boolean {
  // Safari's own flag for a Home Screen app; everyone else answers the media query.
  if ('standalone' in navigator && navigator.standalone) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

/** iPhone and iPad offer push only to the app added to the Home Screen (iOS 16.4 and later). */
export function needsHomeScreen(): boolean {
  const ios =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !isStandalone();
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registers `/sw.js` once per page and waits for it; null where that is not possible. */
export function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  registration ??= navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
  return registration;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const worker = await serviceWorker();
  return worker ? worker.pushManager.getSubscription() : null;
}

/** The subscription as the API stores it; null when the browser hands over something else. */
export function subscriptionInput(subscription: PushSubscription): PushSubscriptionInput | null {
  const parsed = pushSubscriptionSchema.safeParse(subscription.toJSON());
  return parsed.success ? parsed.data : null;
}

/** The base64url VAPID key as the bytes `PushManager.subscribe` wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replaceAll('-', '+')
    .replaceAll('_', '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * Whether the subscription was made with this server key. After the keys were replaced, the
 * push services refuse every push to an old subscription (and not with "gone"), so it has to be
 * made again. A browser that does not say which key it used is taken at its word.
 */
export function subscribedWith(subscription: PushSubscription, publicKey: string): boolean {
  const used = subscription.options?.applicationServerKey;
  if (!used) return true;
  const expected = keyBytes(publicKey);
  const actual = new Uint8Array(used);
  return (
    actual.length === expected.length && actual.every((byte, index) => byte === expected[index])
  );
}

/** A new subscription with the current key, without asking: the permission is already there. */
export async function resubscribe(
  subscription: PushSubscription,
  publicKey: string,
): Promise<PushSubscription | null> {
  await subscription.unsubscribe();
  const worker = await serviceWorker();
  if (!worker) return null;
  return worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
}

export class PushPermissionError extends Error {}

/** Asks for the permission (the browser asks once) and subscribes this browser. */
export async function subscribeThisBrowser(publicKey: string): Promise<PushSubscription> {
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new PushPermissionError('Notifications are blocked for this site in your browser');
  }
  const worker = await serviceWorker();
  if (!worker) throw new Error('This browser cannot receive push notifications');
  return worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
}

/** Unsubscribes this browser; answers the endpoint it had, so the API can forget it too. */
export async function unsubscribeThisBrowser(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  await subscription.unsubscribe();
  return subscription.endpoint;
}

export function pushOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setPushOwner(userId: string | null): void {
  try {
    if (userId === null) localStorage.removeItem(OWNER_KEY);
    else localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Private mode and the like: the owner check falls back to "not this member's".
  }
}

let activeHere = false;

/**
 * Whether this browser receives the signed-in member's pushes: then the service worker shows a
 * message's system notification while the tab is hidden, and `MessageAlerts` does not.
 */
export const pushActiveHere = (): boolean => activeHere;

export function setPushActiveHere(active: boolean): void {
  activeHere = active;
}
