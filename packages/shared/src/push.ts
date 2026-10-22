import { z } from 'zod';
import { NOTIFICATION_PHRASES, type Notification, notificationLink } from './notifications.js';

/** `GET /push/config`: the VAPID public key, or null while the server has push switched off. */
export const pushConfigSchema = z.object({ publicKey: z.string().nullable() });
export type PushConfig = z.infer<typeof pushConfigSchema>;

/**
 * The push services browsers use (Chrome and the Chromium family, Firefox, Safari, Edge). The
 * API posts to a subscription's endpoint, so it only accepts these: anything else would let a
 * client make the server call an address of its choosing (ADR 0022).
 */
const PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);
const PUSH_HOST_SUFFIXES = ['.notify.windows.com'];

export function isPushServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '') return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

const endpointSchema = z
  .string()
  .max(2048)
  .refine(isPushServiceUrl, 'Not the address of a known push service');
const base64url = (min: number, max: number) =>
  z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${min},${max}}={0,2}$`), 'Not a base64url key');

/** `PUT /push/subscriptions`: `PushSubscription.toJSON()` as the browser hands it over. */
export const pushSubscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({ p256dh: base64url(80, 100), auth: base64url(16, 32) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** `DELETE /push/subscriptions`: the device that no longer wants push. */
export const pushEndpointSchema = z.object({ endpoint: z.string().max(2048) });
export type PushEndpointInput = z.infer<typeof pushEndpointSchema>;

/**
 * What a push message carries; the service worker turns it into a system notification. A
 * newer one with the same `tag` replaces the older (one per conversation, one per subject).
 */
export const pushPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  /** A path in the app, opened when the notification is clicked. */
  url: z.string().startsWith('/'),
  tag: z.string(),
  /** Milliseconds since the epoch, when it happened. */
  timestamp: z.number().int(),
});
export type PushPayload = z.infer<typeof pushPayloadSchema>;

/** Longest text a push body carries; the system cuts it shorter anyway. */
export const PUSH_BODY_LENGTH = 140;

export function pushExcerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > PUSH_BODY_LENGTH ? `${flat.slice(0, PUSH_BODY_LENGTH - 1)}…` : flat;
}

/**
 * The push for a notification: the actor as the title, the same words the web shows. A badge
 * has no actor; the API does not push those (they come in bursts, the daily sweep's at night),
 * but the shape stays total.
 */
export function notificationPush(notification: Notification): PushPayload {
  const { phrase, quotes } = NOTIFICATION_PHRASES[notification.type];
  const quoted = quotes === null ? null : notification[quotes];
  const sentence = quoted ? `${phrase}: “${quoted.excerpt}”` : phrase;
  return {
    title: notification.actor?.name ?? 'BeSo',
    body: pushExcerpt(sentence.charAt(0).toUpperCase() + sentence.slice(1)),
    url: notificationLink(notification),
    tag: `notification:${notification.id}`,
    timestamp: Date.parse(notification.createdAt),
  };
}
