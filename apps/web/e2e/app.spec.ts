import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test('the app can be installed and receives push: manifest, icons and the service worker', async ({
  page,
  request,
}) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const body: unknown = await manifest.json();
  expect(body).toMatchObject({
    name: 'BeSo',
    display: 'standalone',
    start_url: '/',
    icons: expect.arrayContaining([expect.objectContaining({ purpose: 'maskable' })]),
  });
  for (const icon of [
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
    '/badge-96.png',
  ]) {
    // oxlint-disable-next-line no-await-in-loop -- four small files
    expect((await request.get(icon)).headers()['content-type']).toBe('image/png');
  }

  // The API has push on (playwright.config.ts), so a signed-in tab registers the worker.
  await openHome(page);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(new URL('/', page.url()).href);

  // Chromium's headless shell has no notifications (the permission stays "denied" even when
  // granted), so the card says they are blocked; switching push on is covered by the web tests
  // with a stubbed browser. The server's side is on: the account's choices are offered.
  await page.goto('/settings');
  await expect(
    page.getByRole('switch', { name: 'Push notifications on this device' }),
  ).toBeVisible();
  await expect(page.getByText(/Notifications are blocked for this site/)).toBeVisible();
  await expect(page.getByRole('switch', { name: 'New messages', exact: true })).toBeChecked();
});
