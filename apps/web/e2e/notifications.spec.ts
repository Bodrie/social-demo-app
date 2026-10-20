import { expect, test } from '@playwright/test';
import { USERS, contextAs, openHome } from './helpers.js';

test('a like by another member rings the bell and leads to the post', async ({ page, browser }) => {
  await openHome(page);
  // Opening the page reads whatever the seed left; the bell is quiet afterwards.
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();

  const text = `Ring my bell ${Date.now()}`;
  await page.goto('/');
  await page.getByLabel('New post').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: text }).first()).toBeVisible();

  const bob = await (await contextAs(browser, 'bob')).newPage();
  await bob.goto(`/u/${USERS.alice.username}`);
  const bobsView = bob.getByRole('article').filter({ hasText: text }).first();
  await expect(bobsView).toBeVisible();
  await bobsView.getByRole('button', { name: /^Like/ }).click();
  await expect(bobsView.getByRole('button', { name: /^Unlike/ })).toContainText('1');

  // Alice's open tab hears about it over the socket.
  const bell = banner.getByRole('link', { name: 'Notifications, 1 unread' });
  await expect(bell).toBeVisible();
  await bell.click();
  const item = page
    .getByRole('list', { name: 'Notifications' })
    .getByRole('listitem')
    .filter({ hasText: 'liked your post' })
    .first();
  await expect(item).toContainText(USERS.bob.name);
  await item.getByRole('link', { name: text }).click();
  await expect(page).toHaveURL(/\/p\//);
  await expect(page.getByRole('article').filter({ hasText: text })).toBeVisible();

  // Clean up: the post goes, and its notification with it.
  await page.getByRole('button', { name: 'Post options' }).click();
  await page.getByRole('menuitem', { name: 'Delete post' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
  await bob.context().close();
});
