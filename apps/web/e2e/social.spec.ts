import { expect, test } from '@playwright/test';
import { USERS, contextAs, openHome } from './helpers.js';

test.describe('between members', () => {
  test('a follow shows up for both sides and the post author moderates comments', async ({
    page,
    browser,
  }) => {
    const bob = await (await contextAs(browser, 'bob')).newPage();

    // Bob makes sure he follows alice.
    await bob.goto(`/u/${USERS.alice.username}`);
    const header = bob.getByRole('region', { name: USERS.alice.name });
    await expect(header.getByRole('heading', { level: 1, name: USERS.alice.name })).toBeVisible();
    const following = header.getByRole('button', { name: 'Following' });
    if (!(await following.isVisible())) {
      await header.getByRole('button', { name: 'Follow', exact: true }).click();
    }
    await expect(following).toBeVisible();

    // Alice sees Bob among her followers and the badge on his profile.
    await openHome(page);
    await page.goto(`/u/${USERS.alice.username}/followers`);
    await expect(
      page.getByRole('list', { name: 'Followers' }).getByRole('link', { name: USERS.bob.name }),
    ).toBeVisible();
    await page.goto(`/u/${USERS.bob.username}`);
    await expect(
      page.getByRole('region', { name: USERS.bob.name }).getByText('Follows you'),
    ).toBeVisible();

    // Alice posts; Bob (a follower) sees it in his feed and comments; alice removes the comment.
    const text = `Moderation check ${Date.now()}`;
    await page.goto('/');
    await page.getByLabel('New post').fill(text);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const alicePost = page.getByRole('article').filter({ hasText: text }).first();
    await expect(alicePost).toBeVisible();

    await bob.goto('/');
    const bobPost = bob.getByRole('article').filter({ hasText: text }).first();
    await expect(bobPost).toBeVisible();
    await bobPost.getByRole('button', { name: /^Comments/ }).click();
    await bobPost.getByLabel('Write a comment').fill('Bob was here');
    await bobPost.getByRole('button', { name: 'Send comment' }).click();
    await expect(bobPost.getByText('Bob was here')).toBeVisible();

    await alicePost.getByRole('button', { name: /^Comments/ }).click();
    await expect(alicePost.getByText('Bob was here')).toBeVisible();
    await alicePost.getByRole('button', { name: 'Delete comment' }).click();
    await expect(alicePost.getByText('Bob was here')).toBeHidden();
    await expect(alicePost.getByRole('button', { name: /^Comments/ })).toContainText('0');

    // Clean up the post so other specs see the seeded feed.
    await alicePost.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
    await bob.context().close();
  });
});
