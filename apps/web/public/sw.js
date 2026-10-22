// BeSo's service worker (ADR 0022): web push only. It caches nothing and handles no fetches,
// so the app and the API always come from the network and a deploy is picked up as before
// (`index.html` is `no-cache`, `lib/new-version.ts` reloads a stale tab). Plain JavaScript in
// `public/`: served as `/sw.js`, unbundled, its scope the whole site.

self.addEventListener('install', () => {
  // A new version takes over at once: there is no cache that could be half old.
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * A push (`PushPayload` in packages/shared: title, body, url, tag, timestamp) becomes a system
 * notification, unless a window of the app is on screen: the open tab shows it its own way
 * (the bell, a chat bubble, the thread).
 */
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = null;
      try {
        payload = event.data ? event.data.json() : null;
      } catch {
        payload = null;
      }
      if (!payload || typeof payload.title !== 'string') return;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((client) => client.visibilityState === 'visible')) return;
      await self.registration.showNotification(payload.title, {
        body: typeof payload.body === 'string' ? payload.body : '',
        tag: typeof payload.tag === 'string' ? payload.tag : undefined,
        timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : undefined,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        data: { url: typeof payload.url === 'string' ? payload.url : '/' },
      });
    })(),
  );
});

/** Opens what the notification is about: in a window of the app if there is one, else a new one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url;
  const target = new URL(
    typeof path === 'string' && path.startsWith('/') ? path : '/',
    self.location.origin,
  );
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === target.origin);
      if (open) {
        await open.focus();
        // The app routes it itself (PushSync), without reloading the page. A service worker's
        // `Client.postMessage` has no target origin: the client is this site's own window.
        // oxlint-disable-next-line unicorn/require-post-message-target-origin
        open.postMessage({ type: 'beso:navigate', url: target.pathname + target.search });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
