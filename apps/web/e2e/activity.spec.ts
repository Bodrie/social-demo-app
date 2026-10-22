import { expect, test } from '@playwright/test';
import { USERS, contextAs, openHome } from './helpers.js';

test('what a followed member does reaches the open Activity page and the sidebar live', async ({
  page,
  browser,
}) => {
  // Alice makes sure she follows bob (the seed's follows are random).
  await openHome(page);
  await page.goto(`/u/${USERS.bob.username}`);
  const header = page.getByRole('region', { name: USERS.bob.name });
  await expect(header.getByRole('heading', { level: 1, name: USERS.bob.name })).toBeVisible();
  const following = header.getByRole('button', { name: 'Following' });
  const followedBefore = await following.isVisible();
  if (!followedBefore) await header.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(following).toBeVisible();

  // A push only reaches a socket that is there, so wait for the page's own.
  const socketOpened = page.waitForEvent('websocket');
  await page.goto('/activity');
  await socketOpened;
  const list = page.getByRole('list', { name: 'Activity', exact: true });
  await expect(list).toBeVisible();

  const text = `Live activity ${Date.now()}`;
  const bob = await (await contextAs(browser, 'bob')).newPage();
  await bob.goto('/');
  await bob.getByLabel('New post').fill(text);
  await bob.getByRole('button', { name: 'Post', exact: true }).click();
  const bobsPost = bob.getByRole('article').filter({ hasText: text }).first();
  await expect(bobsPost).toBeVisible();

  // No reload: the page and the sidebar card both show it.
  await expect(list.getByRole('listitem').first()).toContainText(text);
  await expect(
    page.getByRole('list', { name: 'Latest activity' }).getByRole('listitem').first(),
  ).toContainText(text);

  // Clean up: the post goes, and its activity with it.
  await bobsPost.getByRole('button', { name: 'Post options' }).click();
  await bob.getByRole('menuitem', { name: 'Delete post' }).click();
  await bob.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(bob.getByRole('article').filter({ hasText: text })).toHaveCount(0);
  await bob.context().close();
  if (!followedBefore) {
    await page.goto(`/u/${USERS.bob.username}`);
    await header.getByRole('button', { name: 'Following' }).click();
    await expect(header.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
  }
});
