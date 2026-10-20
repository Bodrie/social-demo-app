import { type Page, expect, test } from '@playwright/test';
import { USERS, contextAs, openHome } from './helpers.js';

/** Puts `page`'s member in the "Following" or "Follow" state towards `username`. */
async function setFollowing(page: Page, username: string, name: string, following: boolean) {
  await page.goto(`/u/${username}`);
  const header = page.getByRole('region', { name });
  await expect(header.getByRole('heading', { level: 1, name })).toBeVisible();
  const followingButton = header.getByRole('button', { name: 'Following' });
  const isFollowing = await followingButton.isVisible();
  if (following && !isFollowing) {
    await header.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(followingButton).toBeVisible();
  } else if (!following && isFollowing) {
    await followingButton.click();
    await expect(header.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
  }
}

test('a repost reaches the reposter’s followers and a quote embeds the original', async ({
  page,
  browser,
}) => {
  // carol follows bob and not alice, so whatever alice wrote reaches her only through bob.
  const carol = await (await contextAs(browser, 'carol')).newPage();
  await setFollowing(carol, USERS.bob.username, USERS.bob.name, true);
  await setFollowing(carol, USERS.alice.username, USERS.alice.name, false);

  await openHome(page);
  const text = `Spread the word ${Date.now()}`;
  await page.getByLabel('New post').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: text }).first()).toBeVisible();

  // bob reposts it from alice's profile …
  const bob = await (await contextAs(browser, 'bob')).newPage();
  await bob.goto(`/u/${USERS.alice.username}`);
  const onBobsScreen = bob.getByRole('article').filter({ hasText: text }).first();
  await onBobsScreen.getByRole('button', { name: 'Repost 0' }).click();
  await bob.getByRole('button', { name: 'Repost', exact: true }).click();
  await expect(onBobsScreen.getByRole('button', { name: 'Repost 1' })).toBeVisible();

  // … and carol sees it in her feed, marked as bob's repost.
  await carol.goto('/');
  const viaBob = carol.getByRole('article').filter({ hasText: text }).first();
  await expect(viaBob).toBeVisible();
  await expect(viaBob).toContainText(`${USERS.bob.name} reposted`);

  // bob quotes it: his quote shows his words over the embedded original.
  const take = `My take ${Date.now()}`;
  await onBobsScreen.getByRole('button', { name: 'Repost 1' }).click();
  await bob.getByLabel('Add your thoughts (optional)').fill(take);
  await bob.getByRole('button', { name: 'Quote' }).click();
  await expect(bob.getByText('Quote posted')).toBeVisible();
  await bob.goto('/');
  const quote = bob.getByRole('article').filter({ hasText: take }).first();
  await expect(quote).toBeVisible();
  await expect(quote).toContainText(text);
  await expect(quote.getByRole('link', { name: /open the quoted post/ })).toBeVisible();

  // Clean up: the quote and the repost go, then the post.
  await quote.getByRole('button', { name: 'Post options' }).click();
  await bob.getByRole('menuitem', { name: 'Delete post' }).click();
  await bob.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(bob.getByRole('article').filter({ hasText: take })).toHaveCount(0);
  await bob.goto(`/u/${USERS.alice.username}`);
  const again = bob.getByRole('article').filter({ hasText: text }).first();
  await again.getByRole('button', { name: 'Repost 1' }).click();
  await bob.getByRole('button', { name: 'Undo repost' }).click();
  await expect(again.getByRole('button', { name: 'Repost 0' })).toBeVisible();
  await bob.context().close();
  await carol.context().close();

  await page.goto('/');
  const mine = page.getByRole('article').filter({ hasText: text }).first();
  await mine.getByRole('button', { name: 'Post options' }).click();
  await page.getByRole('menuitem', { name: 'Delete post' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
});
