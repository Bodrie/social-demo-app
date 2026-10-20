import { expect, test } from '@playwright/test';
import { ANONYMOUS, USERS, contextAs, registerAndConfirm } from './helpers.js';

// A throwaway member does the blocking: a block between the seeded members would reach the
// other specs that run as them at the same time.
test.use({ storageState: ANONYMOUS });

test('a block hides the two members from each other until it is lifted, and a report goes through', async ({
  page,
  browser,
}) => {
  const member = await registerAndConfirm(page);
  const text = `Nothing to see ${Date.now()}`;
  await page.getByLabel('New post').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: text }).first()).toBeVisible();

  await page.goto(`/u/${USERS.bob.username}`);
  const bobsProfile = page.getByRole('region', { name: USERS.bob.name });
  await bobsProfile.getByRole('button', { name: 'Profile options' }).click();
  await page.getByRole('menuitem', { name: `Block @${USERS.bob.username}` }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Block' }).click();
  await expect(bobsProfile.getByText('You blocked this member', { exact: false })).toBeVisible();

  // Bob gets the reduced profile and none of the member's posts.
  const bob = await (await contextAs(browser, 'bob')).newPage();
  await bob.goto(`/u/${member.username}`);
  const theirProfile = bob.getByRole('region', { name: member.name });
  await expect(theirProfile.getByText('This profile is not available')).toBeVisible();
  await expect(theirProfile.getByRole('button', { name: /^Follow/ })).toHaveCount(0);
  await expect(bob.getByRole('article').filter({ hasText: text })).toHaveCount(0);

  // Lifted from Settings → Privacy: bob sees the profile and the post again.
  await page.goto('/settings');
  await page
    .getByRole('list', { name: 'Blocked members' })
    .getByRole('button', { name: `Unblock @${USERS.bob.username}` })
    .click();
  await expect(page.getByText('You have not blocked anyone.')).toBeVisible();
  await bob.goto(`/u/${member.username}`);
  await expect(theirProfile.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
  const post = bob.getByRole('article').filter({ hasText: text }).first();
  await expect(post).toBeVisible();

  // A report on that post.
  await post.getByRole('button', { name: 'Post options' }).click();
  await bob.getByRole('menuitem', { name: 'Report post' }).click();
  const dialog = bob.getByRole('dialog', { name: 'Report this post' });
  await dialog.getByLabel('Spam or scam').check();
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(bob.getByText('Thank you. We will look into it.')).toBeVisible();
  await bob.context().close();
});
